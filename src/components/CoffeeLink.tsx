const COFFEE_URL = "https://www.buymeacoffee.com/lGoDO3E048";
// Official dynamic button (shows live supporter count) — an image only, no scripts.
const BUTTON_SRC =
  "https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=lGoDO3E048&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff";

export default function CoffeeLink({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground/60 underline-offset-2 transition hover:text-foreground hover:underline"
      >
        ☕ Buy me a coffee
      </a>
    );
  }

  return (
    <a
      href={COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex justify-center transition active:scale-[0.98]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BUTTON_SRC}
        alt="☕ Buy me a coffee"
        className="h-12 w-auto rounded-lg"
      />
    </a>
  );
}
