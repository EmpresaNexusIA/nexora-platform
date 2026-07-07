# 0002. Traefik como reverse proxy

**Fecha:** 2026-07-07
**Estado:** Aceptada

## Contexto

Todo servicio con ruta pública necesita TLS y un punto central de enrutamiento
por dominio/subdominio. La plataforma va a sumar servicios continuamente
(sub-proyectos 2 a 9) y no queremos que cada alta implique editar un archivo
de configuración central de proxy.

## Decisión

Traefik es el reverse proxy único de la plataforma. Descubre servicios
automáticamente por labels de Docker (`traefik.enable=true`,
`traefik.http.routers.*`) — dar de alta un servicio nuevo es agregar labels a
su propio `compose.yaml`, no tocar configuración de Traefik.

En producción (VPS, fuera de alcance del sub-proyecto 1), Traefik gestiona
TLS automático vía Let's Encrypt. En desarrollo local, donde `*.nexora.localhost`
no es un dominio públicamente resoluble y el desafío HTTP de Let's Encrypt no
puede completarse, se usa **mkcert** para emitir una CA local instalada en el
almacén de confianza del sistema (Windows) y de WSL, de forma que
`https://*.nexora.localhost` presente un certificado realmente confiable (sin
warnings de navegador ni `curl -k`) sin depender de infraestructura externa.

Dashboard de Traefik expuesto en subdominio propio (`traefik.nexora.localhost`)
protegido con basic auth (credenciales en `secrets/traefik.env`, gitignored).

## Alternativas consideradas

- **Nginx con configuración manual** — más conocido, pero cada servicio nuevo
  requiere escribir/editar un `server {}` a mano y recargar Nginx; sin
  integración nativa con labels de Docker.
- **Nginx Proxy Companion (docker-gen + nginx + letsencrypt-companion)** —
  logra auto-discovery, pero son 3 contenedores coordinados en vez de uno, y
  el ecosistema de plugins/middlewares es más limitado que el de Traefik.
- **Caddy** — también tiene TLS automático y config simple, pero su
  auto-discovery de contenedores Docker requiere un plugin de terceros
  (no está en el core), mientras que en Traefik es un provider oficial.

## Consecuencias

- Nuevo servicio con ruta pública = agregar labels `traefik.*` a su
  `compose.yaml`, sin editar `infra/traefik/`.
- El dashboard queda protegido desde el día uno, no expuesto sin auth.
- La CA de mkcert es local a cada máquina de desarrollo — cada developer que
  clone el repo tiene que correr su propio `mkcert -install` (documentado en
  el plan de implementación de este sub-proyecto), no es algo que se pueda
  commitear.
- El certResolver de Let's Encrypt para producción se configura recién en el
  sub-proyecto de deploy al VPS, cuando exista un dominio público real —
  configurarlo antes con datos ficticios sería incorrecto.
