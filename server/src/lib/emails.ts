import type { Mail } from "./mailer.js";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
    <p style="margin:0 0 24px;font-weight:600;font-size:18px;color:#4338ca">Atarefado</p>
    <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
    ${body}
    <p style="margin:32px 0 0;font-size:12px;color:#64748b">Desenvolvido por Marlon Giovany</p>
  </div>
</body>
</html>`;
}

export function passwordResetEmail(to: string, name: string, link: string, validMinutes: number): Mail {
  const safeName = escapeHtml(name);
  return {
    to,
    subject: "Redefinição de senha do Atarefado",
    text: [
      `Olá, ${name}.`,
      "",
      "Recebemos um pedido para redefinir a senha da sua conta no Atarefado.",
      `Para criar uma nova senha, acesse o link abaixo (válido por ${validMinutes} minutos e utilizável uma única vez):`,
      "",
      link,
      "",
      "Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.",
    ].join("\n"),
    html: layout(
      "Redefinição de senha",
      `<p>Olá, ${safeName}.</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Atarefado.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Criar nova senha</a>
      </p>
      <p style="font-size:14px;color:#475569">O link é válido por ${validMinutes} minutos e pode ser usado uma única vez.</p>
      <p style="font-size:14px;color:#475569">Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>`,
    ),
  };
}

/** Sent instead of a reset link when the account has no password (Google only). */
export function googleAccountEmail(to: string, name: string, loginLink: string): Mail {
  const safeName = escapeHtml(name);
  return {
    to,
    subject: "Sua conta do Atarefado usa o login com Google",
    text: [
      `Olá, ${name}.`,
      "",
      "Recebemos um pedido de redefinição de senha, mas a sua conta do Atarefado não tem senha:",
      "você entra usando a sua conta Google.",
      "",
      `Para entrar, acesse ${loginLink} e clique em “Continuar com o Google”.`,
      "Se quiser, depois de entrar você pode criar uma senha em “Minha conta”.",
      "",
      "Se você não fez esse pedido, ignore este e-mail.",
    ].join("\n"),
    html: layout(
      "Sua conta usa o login com Google",
      `<p>Olá, ${safeName}.</p>
      <p>Recebemos um pedido de redefinição de senha, mas a sua conta do Atarefado não tem senha: você entra usando a sua conta Google.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(loginLink)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Ir para o login</a>
      </p>
      <p style="font-size:14px;color:#475569">Lá, clique em “Continuar com o Google”. Se quiser, depois de entrar você pode criar uma senha em “Minha conta”.</p>
      <p style="font-size:14px;color:#475569">Se você não fez esse pedido, ignore este e-mail.</p>`,
    ),
  };
}
