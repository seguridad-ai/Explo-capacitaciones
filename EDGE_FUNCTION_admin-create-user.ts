import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ ok: false, error: 'Método no permitido.' }, { status: 405 })
    }

    try {
      const callerId = ctx.userClaims?.id
      if (!callerId) {
        return Response.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 })
      }

      const { data: callerProfile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('id,rol_codigo,activo')
        .eq('id', callerId)
        .single()

      if (profileError || !callerProfile?.activo || callerProfile.rol_codigo !== 'ADMIN') {
        return Response.json(
          { ok: false, error: 'Solo un administrador activo puede crear usuarios.' },
          { status: 403 }
        )
      }

      const body = await req.json()
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const nombres = String(body.nombres || '').trim()
      const apellidos = String(body.apellidos || '').trim()
      const cargo = String(body.cargo || '').trim()
      const rol = String(body.rol_codigo || 'PROYECTO').trim().toUpperCase()
      const projectIds = Array.isArray(body.proyecto_ids)
        ? [...new Set(body.proyecto_ids.map(String))]
        : []

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return Response.json({ ok:false, error:'Correo electrónico no válido.' }, { status:400 })
      }
      if (password.length < 8) {
        return Response.json({ ok:false, error:'La contraseña debe tener al menos 8 caracteres.' }, { status:400 })
      }
      if (!nombres || !apellidos || !cargo) {
        return Response.json({ ok:false, error:'Completa nombres, apellidos y cargo.' }, { status:400 })
      }
      if (!['ADMIN','GERENCIA','PROYECTO'].includes(rol)) {
        return Response.json({ ok:false, error:'Rol no válido.' }, { status:400 })
      }
      if (rol === 'PROYECTO' && projectIds.length === 0) {
        return Response.json({ ok:false, error:'Selecciona al menos un proyecto.' }, { status:400 })
      }

      const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombres, apellidos }
      })

      if (createError || !created.user) {
        const message = createError?.message || 'No fue posible crear el usuario.'
        return Response.json(
          {
            ok: false,
            error: /already|registered|exists/i.test(message)
              ? 'Ya existe un usuario con ese correo.'
              : message
          },
          { status: 400 }
        )
      }

      const userId = created.user.id

      const { error: updateError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({
          email,
          nombres,
          apellidos,
          cargo,
          rol_codigo: rol,
          activo: true
        })
        .eq('id', userId)

      if (updateError) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('profile update error', updateError)
        return Response.json(
          { ok:false, error:'No fue posible configurar el perfil del usuario.' },
          { status:500 }
        )
      }

      if (rol === 'PROYECTO') {
        const rows = projectIds.map(proyecto_id => ({
          user_id: userId,
          proyecto_id,
          activo: true
        }))

        const { error: assignError } = await ctx.supabaseAdmin
          .from('usuarios_proyectos')
          .insert(rows)

        if (assignError) {
          await ctx.supabaseAdmin.auth.admin.deleteUser(userId)
          console.error('project assignment error', assignError)
          return Response.json(
            { ok:false, error:'No fue posible asignar los proyectos al usuario.' },
            { status:500 }
          )
        }
      }

      return Response.json({ ok:true, user_id:userId, email })
    } catch (error) {
      console.error('admin-create-user error', error)
      return Response.json(
        {
          ok:false,
          error:error instanceof Error ? error.message : 'Error interno al crear el usuario.'
        },
        { status:500 }
      )
    }
  })
}
