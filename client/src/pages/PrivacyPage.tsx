import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Credit, Logo } from '../components/ui'

const CONTACT = 'atarefado.app@gmail.com'
const UPDATED = '2 de outubro de 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

/** Public privacy policy (required by Google to publish "Sign in with Google"). */
export function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link to="/" className="rounded-md">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-slate-500">Última atualização: {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          O Atarefado é um gerenciador de tarefas desenvolvido por Marlon Giovany como projeto de
          portfólio. Esta política explica quais dados o app coleta, por que e o que você pode
          fazer com eles, conforme a Lei Geral de Proteção de Dados (LGPD).
        </p>

        <Section title="Dados que coletamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Conta:</strong> nome e e-mail. A senha nunca é guardada: armazenamos apenas
              um hash criptográfico (bcrypt) dela.
            </li>
            <li>
              <strong>Login com Google:</strong> o identificador da sua conta Google, seu nome e seu
              e-mail. Não recebemos sua senha do Google nem acessamos outros dados da sua conta.
            </li>
            <li>
              <strong>Conteúdo:</strong> os quadros, colunas e tarefas que você cria e os membros
              que convida.
            </li>
            <li>
              <strong>Dados técnicos:</strong> registros de acesso da hospedagem (como endereço IP e
              horário) e contadores temporários de tentativas de login, guardados apenas em forma
              de hash, para proteger as contas contra ataques.
            </li>
          </ul>
        </Section>

        <Section title="Como usamos os dados">
          <p>
            Apenas para fazer o app funcionar: criar e manter sua conta, permitir o login, mostrar
            seus quadros, permitir a colaboração com os membros que você convidar (eles veem seu
            nome e e-mail) e enviar e-mails de redefinição de senha que você solicitar.
          </p>
          <p>
            Não vendemos, alugamos nem usamos seus dados para publicidade. Não há rastreamento nem
            ferramentas de análise de terceiros.
          </p>
        </Section>

        <Section title="Dados do Google">
          <p>
            O uso de informações recebidas das APIs do Google segue a{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de uso limitado. Esses dados servem somente para identificar
            você no login e não são compartilhados com ninguém.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Usamos um único cookie, necessário para manter você conectado (cookie de sessão
            protegido, válido por até 7 dias). Não usamos cookies de publicidade ou de análise.
          </p>
        </Section>

        <Section title="Onde os dados ficam">
          <p>
            O app é hospedado pela Vercel e o banco de dados pelo Neon, com servidores nos Estados
            Unidos. Os e-mails são enviados pelo Gmail. Esses serviços processam os dados apenas
            para operar o Atarefado.
          </p>
        </Section>

        <Section title="Por quanto tempo">
          <p>
            Enquanto sua conta existir. Sessões expiram em 7 dias, links de redefinição de senha
            em 30 minutos e os contadores de tentativas de login em até 1 hora. Quando você pede a
            exclusão da conta, seus dados são apagados.
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados, ou tirar dúvidas sobre esta
            política, pelo e-mail{' '}
            <a href={`mailto:${CONTACT}`} className="font-medium text-indigo-600 hover:text-indigo-500">
              {CONTACT}
            </a>
            . Respondemos em até 15 dias.
          </p>
        </Section>

        <Section title="Segurança">
          <p>
            Conexões sempre por HTTPS, senhas e tokens guardados apenas como hash, proteção contra
            tentativas repetidas de login e controle de acesso em todos os quadros.
          </p>
        </Section>

        <p className="mt-10 text-sm">
          <Link to="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            ← Voltar para o Atarefado
          </Link>
        </p>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center">
        <Credit />
      </footer>
    </div>
  )
}
