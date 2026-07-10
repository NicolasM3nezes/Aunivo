import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  className = "",
  priority = false,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      aria-label="Aunivo — Página inicial"
      className={`inline-flex items-center transition-opacity hover:opacity-90 ${className}`}
    >
      <Image
        src="/brand/aunivo-logo.png"
        alt="Aunivo"
        width={220}
        height={72}
        priority={priority}
        className="h-9 w-auto object-contain sm:h-10"
      />
    </Link>
  );
}
