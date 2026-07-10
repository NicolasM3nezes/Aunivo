import { getRequestConfig } from "next-intl/server";

const supportedLocales = ["pt-BR", "en"] as const;

type SupportedLocale = (typeof supportedLocales)[number];

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

export default getRequestConfig(async () => {
  const environmentLocale =
    process.env.NEXT_PUBLIC_APP_LOCALE ?? "pt-BR";

  const locale: SupportedLocale = isSupportedLocale(environmentLocale)
    ? environmentLocale
    : "pt-BR";

  try {
    const messages = (
      await import(`../../messages/${locale}.json`)
    ).default;

    return {
      locale,
      messages,
    };
  } catch {
    const messages = (
      await import("../../messages/en.json")
    ).default;

    return {
      locale: "en",
      messages,
    };
  }
});