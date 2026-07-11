import Image from 'next/image';
import Link from 'next/link';

type AunivoBrandProps = {
  href?: string;
  priority?: boolean;
  className?: string;
};

export function AunivoBrand({
  href = '/',
  priority = false,
  className = '',
}: AunivoBrandProps) {
  return (
    <Link
      href={href}
      aria-label="Aunivo — Página inicial"
      className={`inline-flex shrink-0 items-center transition-opacity hover:opacity-90 ${className}`}
    >
      <Image
        src="/brand/aunivo-logo.png"
        alt="Aunivo"
        width={220}
        height={72}
        priority={priority}
        className="h-9 w-auto object-contain dark:hidden sm:h-10"
      />

      <Image
        src="/brand/aunivo-logo-white.png"
        alt="Aunivo"
        width={220}
        height={72}
        priority={priority}
        className="hidden h-9 w-auto object-contain dark:block sm:h-10"
      />
    </Link>
  );
}