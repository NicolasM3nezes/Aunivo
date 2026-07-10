import Link from 'next/link';
import { AunivoBrand } from './brand';

export function PublicFooter() {
  return (
    <footer className="border-border bg-muted/20 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <AunivoBrand />
          <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-6">
            Automação comercial com inteligência artificial para empresas que
            vendem e atendem pelo WhatsApp.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Produto</h2>
          <div className="text-muted-foreground mt-4 flex flex-col gap-3 text-sm">
            <Link href="/#recursos">Recursos</Link>
            <Link href="/#como-funciona">Como funciona</Link>
            <Link href="/planos">Planos</Link>
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar conta</Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Informações</h2>
          <div className="text-muted-foreground mt-4 flex flex-col gap-3 text-sm">
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Política de privacidade</Link>
            <Link href="/planos#contato">Contato comercial</Link>
          </div>
        </div>
      </div>
      <div className="border-border text-muted-foreground border-t px-4 py-5 text-center text-xs">
        © {new Date().getFullYear()} Aunivo. Todos os direitos reservados.
      </div>
    </footer>
  );
}
