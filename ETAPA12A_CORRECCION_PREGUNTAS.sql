-- ETAPA 12A - CORRECCIÓN PARA GUARDAR PREGUNTAS DE PRACTICAR

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

        if v_practica_id is null then
            return jsonb_build_object('ok', false, 'error', 'La pregunta no existe.');
        end if;
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

revoke all on function public.guardar_pregunta_practica(
    uuid,uuid,text,text,text,text,text,integer
) from public;

grant execute on function public.guardar_pregunta_practica(
    uuid,uuid,text,text,text,text,text,integer
) to authenticated;

select 'Etapa 12A aplicada correctamente' as resultado;
