import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return json({ ok: false, error: "Falta configuración del servidor." }, 500);
    }

    const { token, dni, video_id } = await req.json();
    if (!token || !/^[0-9]{8}$/.test(String(dni || "")) || !video_id) {
      return json({ ok: false, error: "Solicitud incompleta." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: cap, error: capError } = await admin
      .from("comite_sst_capacitaciones")
      .select("id,comite_id,estado")
      .eq("public_token", token)
      .maybeSingle();

    if (capError || !cap || cap.estado !== "LISTA") {
      return json({ ok: false, error: "La capacitación no se encuentra disponible." }, 404);
    }

    const { data: worker, error: workerError } = await admin
      .from("trabajadores")
      .select("id,dni,activo")
      .eq("dni", String(dni))
      .maybeSingle();

    if (workerError || !worker || !worker.activo) {
      return json({ ok: false, error: "El trabajador no se encuentra activo en la base maestra." }, 403);
    }

    const { data: member, error: memberError } = await admin
      .from("comite_sst_integrantes")
      .select("id,trabajador_id,activo,fecha_fin")
      .eq("comite_id", cap.comite_id)
      .eq("trabajador_id", worker.id)
      .eq("activo", true)
      .maybeSingle();

    if (memberError || !member) {
      return json({ ok: false, error: "No figuras como integrante activo de esta capacitación." }, 403);
    }

    if (member.fecha_fin) {
      const endDate = new Date(`${member.fecha_fin}T23:59:59`);
      if (endDate.getTime() < Date.now()) {
        return json({ ok: false, error: "Tu participación en la conformación ya no se encuentra vigente." }, 403);
      }
    }

    const { data: participant, error: participantError } = await admin
      .from("comite_sst_capacitacion_participantes")
      .select("id,firma_at,consentimiento_firma")
      .eq("capacitacion_id", cap.id)
      .eq("trabajador_id", worker.id)
      .maybeSingle();

    if (participantError || !participant || !participant.firma_at || !participant.consentimiento_firma) {
      return json({ ok: false, error: "Debes registrar tu firma antes de reproducir los videos." }, 403);
    }

    const { data: video, error: videoError } = await admin
      .from("comite_sst_capacitacion_videos")
      .select("id,capacitacion_id,orden,tipo_fuente,storage_path")
      .eq("id", video_id)
      .eq("capacitacion_id", cap.id)
      .maybeSingle();

    if (videoError || !video || video.tipo_fuente !== "MP4_UPLOAD" || !video.storage_path) {
      return json({ ok: false, error: "No se encontró un MP4 válido para reproducir." }, 404);
    }

    // Secuencia: no entrega URL si existe un video obligatorio anterior pendiente.
    const { data: previousVideos, error: previousError } = await admin
      .from("comite_sst_capacitacion_videos")
      .select("id,orden,obligatorio")
      .eq("capacitacion_id", cap.id)
      .lt("orden", video.orden)
      .eq("obligatorio", true);

    if (previousError) throw previousError;

    if ((previousVideos || []).length) {
      const previousIds = (previousVideos || []).map((row: any) => row.id);
      const { data: previousProgress, error: progressError } = await admin
        .from("comite_sst_capacitacion_video_progreso")
        .select("video_id,completado")
        .eq("participante_id", participant.id)
        .in("video_id", previousIds);

      if (progressError) throw progressError;
      const completed = new Set(
        (previousProgress || []).filter((row: any) => row.completado).map((row: any) => row.video_id)
      );
      if (previousIds.some((id: string) => !completed.has(id))) {
        return json({ ok: false, error: "Completa primero los videos obligatorios anteriores." }, 409);
      }
    }

    const { data: signed, error: signedError } = await admin.storage
      .from("comite-sst-capacitaciones")
      .createSignedUrl(video.storage_path, 60 * 60 * 2);

    if (signedError || !signed?.signedUrl) {
      return json({ ok: false, error: "No fue posible generar el enlace temporal del video." }, 500);
    }

    return json({ ok: true, signed_url: signed.signedUrl, expires_in: 7200 });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Error interno." }, 500);
  }
});
