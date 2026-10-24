-- ============================================================
-- EXPLO DRILLING PERÚ
-- ETAPA 12B - CORRECCIÓN DEFINITIVA DE PREGUNTAS EN PRACTICAR
-- ============================================================

create or replace function public.guardar_pregunta_practica(
    p_practica_id uuid,
    p_pregunta_id uuid,
    p_enunciado text,
    p_opcion_a text,
    p_opcion_b text,
    p_opcion_c text,
    p_opcion_d text,
    p_correcta integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_practica_id uuid;
    v_pregunta_id uuid;
    v_orden integer;
begin
    if auth.uid() is null then
        return jsonb_build_object('ok', false, 'error', 'Sesión no válida.');
    end if;

    if p_pregunta_id is not null then
        select practica_id into v_practica_id
        from public.practica_preguntas
        where id = p_pregunta_id
        limit 1;
    else
        v_practica_id := p_practica_id;
    end if;

    if v_practica_id is null then
        return jsonb_build_object('ok', false, 'error', 'No se identificó el quiz.');
    end if;

    if not public.can_manage_practice(v_practica_id) then
        return jsonb_build_object('ok', false, 'error', 'No tienes permiso para modificar este quiz.');
    end if;

    if btrim(coalesce(p_enunciado,'')) = '' then
        return jsonb_build_object('ok', false, 'error', 'Ingresa el enunciado de la pregunta.');
    end if;

    if btrim(coalesce(p_opcion_a,'')) = ''
       or btrim(coalesce(p_opcion_b,'')) = ''
       or btrim(coalesce(p_opcion_c,'')) = ''
       or btrim(coalesce(p_opcion_d,'')) = '' then
        return jsonb_build_object('ok', false, 'error', 'Completa las cuatro alternativas.');
    end if;

    if p_correcta not between 1 and 4 then
        return jsonb_build_object('ok', false, 'error', 'Selecciona la respuesta correcta.');
    end if;

    if p_pregunta_id is null then
        select coalesce(max(orden),0) + 1
          into v_orden
        from public.practica_preguntas
        where practica_id = v_practica_id;

        insert into public.practica_preguntas(practica_id, orden, enunciado, activo)
        values(v_practica_id, v_orden, btrim(p_enunciado), true)
        returning id into v_pregunta_id;
    else
        v_pregunta_id := p_pregunta_id;

        update public.practica_preguntas
        set enunciado = btrim(p_enunciado),
            activo = true
        where id = v_pregunta_id;

        delete from public.practica_opciones
        where pregunta_id = v_pregunta_id;
    end if;

    insert into public.practica_opciones(pregunta_id, orden, texto, es_correcta)
    values
        (v_pregunta_id, 1, btrim(p_opcion_a), p_correcta = 1),
        (v_pregunta_id, 2, btrim(p_opcion_b), p_correcta = 2),
        (v_pregunta_id, 3, btrim(p_opcion_c), p_correcta = 3),
        (v_pregunta_id, 4, btrim(p_opcion_d), p_correcta = 4);

    return jsonb_build_object(
        'ok', true,
        'pregunta_id', v_pregunta_id,
        'message', 'Pregunta guardada correctamente.'
    );
exception
    when others then
        return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

create or replace function public.listar_preguntas_practica_admin(
    p_practica_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    if auth.uid() is null then
        return jsonb_build_object('ok', false, 'error', 'Sesión no válida.');
    end if;

    if not public.can_view_practice(p_practica_id) then
        return jsonb_build_object('ok', false, 'error', 'No tienes acceso a este quiz.');
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', q.id,
            'practica_id', q.practica_id,
            'orden', q.orden,
            'enunciado', q.enunciado,
            'activo', q.activo,
            'opciones', (
                select coalesce(jsonb_agg(
                    jsonb_build_object(
                        'id', o.id,
                        'orden', o.orden,
                        'texto', o.texto,
                        'es_correcta', o.es_correcta
                    ) order by o.orden
                ), '[]'::jsonb)
                from public.practica_opciones o
                where o.pregunta_id = q.id
            )
        ) order by q.orden
    ), '[]'::jsonb)
    into v_result
    from public.practica_preguntas q
    where q.practica_id = p_practica_id
      and q.activo = true;

    return jsonb_build_object('ok', true, 'preguntas', v_result);
end;
$$;

create or replace function public.eliminar_pregunta_practica(
    p_pregunta_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_practica_id uuid;
begin
    select practica_id into v_practica_id
    from public.practica_preguntas
    where id = p_pregunta_id
    limit 1;

    if v_practica_id is null then
        return jsonb_build_object('ok', false, 'error', 'La pregunta no existe.');
    end if;

    if not public.can_manage_practice(v_practica_id) then
        return jsonb_build_object('ok', false, 'error', 'No tienes permiso para eliminar esta pregunta.');
    end if;

    delete from public.practica_preguntas
    where id = p_pregunta_id;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.guardar_pregunta_practica(uuid,uuid,text,text,text,text,text,integer) from public;
revoke all on function public.listar_preguntas_practica_admin(uuid) from public;
revoke all on function public.eliminar_pregunta_practica(uuid) from public;

grant execute on function public.guardar_pregunta_practica(uuid,uuid,text,text,text,text,text,integer) to authenticated;
grant execute on function public.listar_preguntas_practica_admin(uuid) to authenticated;
grant execute on function public.eliminar_pregunta_practica(uuid) to authenticated;

select 'Etapa 12B aplicada correctamente' as resultado;
