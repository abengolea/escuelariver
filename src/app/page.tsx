import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RiverPlateLogo } from "@/components/icons/RiverPlateLogo";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      <header className="px-4 lg:px-6 h-14 flex items-center min-w-0 gap-2 sm:gap-4">
        <Link href="/" className="flex items-center justify-center shrink-0 min-w-0">
          <RiverPlateLogo className="h-8 w-8 shrink-0" />
          <span className="ml-2 text-base sm:text-lg font-bold font-headline uppercase truncate max-w-[50vw] sm:max-w-none">
            <span className="text-primary">ESCUELA</span>{" "}
            <span className="text-foreground">RIVER</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-2 sm:gap-4 shrink-0">
          <Button variant="ghost" asChild size="sm" className="text-xs sm:text-sm">
            <Link href="/notas">Notas</Link>
          </Button>
          <Button variant="ghost" asChild size="sm" className="text-xs sm:text-sm">
            <Link href="/auth/login">Iniciar Sesión</Link>
          </Button>
          <Button asChild size="sm" className="text-xs sm:text-sm">
            <Link href="/auth/registro">
              <span className="hidden sm:inline">Registrarme como jugador</span>
              <span className="sm:hidden">Registrarme</span>
            </Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                   <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm font-medium">Para Entrenadores y Admins</div>
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline text-primary">
                    Gestiona el Futuro del Fútbol
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Nuestra plataforma integral te ayuda a seguir el desarrollo de cada jugador, desde sus primeros pasos hasta convertirse en un atleta de élite.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg">
                    <Link href="/auth/login">Acceder al Panel</Link>
                  </Button>
                </div>
              </div>
              <Image
                src="/images/hero-chicos-futbol.png.jpeg"
                width={600}
                height={400}
                alt="Jugadores de fútbol en Escuelas River"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
              />
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
          <div className="container px-4 md:px-6">
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_550px]">
              <Image
                src="/images/river_foto2.jpeg"
                width={550}
                height={310}
                alt="Jugadores de fútbol en Escuelas River"
                className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full lg:order-first"
              />
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-primary/10 text-primary px-3 py-1 text-sm font-medium">Para Jugadores y Familias</div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">¿Sos parte de la Escuela?</h2>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Creá tu cuenta como jugador. Un administrador de la escuela te aprobará para acceder al panel.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/auth/registro">Registrarme como jugador</Link>
                  </Button>
                </div>
                 <p className="text-xs text-muted-foreground">Completá el registro, verificá tu email y un administrador te aprobará para acceder al panel.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Escuelas River. Todos los derechos reservados.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Términos de Servicio
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4">
            Política de Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}
