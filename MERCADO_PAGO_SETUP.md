# Configuración de Mercado Pago - Checkout API

## Información de la Aplicación

- **Número de aplicación**: 7442930972658116
- **User ID**: 72184115
- **Integración con**: CheckoutAPI
- **API integrada**: API Pagos
- **Public API Key**: TEST-630a6706-0ef3-4a93-a1be-e91ad10d0ce3
- **Access Token**: TEST-7442930972658116-011716-8d4510b85b45d42ff077abd51647b196-72184115

## Variables de Entorno Requeridas

### Backend (PPP-NEST)

Añade las siguientes variables a tu archivo `.env` en el backend:

```env
# Mercado Pago Configuration - Checkout API
MERCADO_PAGO_ACCESS_TOKEN=TEST-7442930972658116-011716-8d4510b85b45d42ff077abd51647b196-72184115

# URLs para callbacks (opcionales, tienen valores por defecto)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
```

### Frontend (ppp-front)

Crea un archivo `.env.local` o `.env` en el frontend con:

```env
# Mercado Pago Public Key (usado en frontend si es necesario)
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-630a6706-0ef3-4a93-a1be-e91ad10d0ce3
```

**Nota**: Actualmente usamos Preferences API que no requiere el public key en el frontend, pero está disponible si lo necesitas.

### Cómo obtener tu Access Token completo:

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.co/developers)
2. Inicia sesión con tu cuenta de Mercado Pago
3. Ve a "Tus integraciones" → Selecciona tu aplicación (7442930972658116)
4. Ve a "Credenciales" → Copia tu **Access Token** completo
   - **Test**: Para pruebas en modo sandbox
   - **Production**: Para pagos reales
5. El token completo tiene formato: `TEST-XXXXXX-XXXXXX-XXXXXX-XXXXXX`  
   **Token actual configurado**: `TEST-7442930972658116-011716-8d4510b85b45d42ff077abd51647b196-72184115`

### Configuración del Webhook:

1. En Mercado Pago Developers, ve a tu aplicación (7442930972658116)
2. Ve a "Webhooks"
3. Configura la URL: `https://tu-dominio.com/api/payments/webhook`
4. **Para desarrollo local CON redirección automática**, usa ngrok:
   ```bash
   # Terminal 1: Inicia tu backend
   npm run start:dev
   
   # Terminal 2: Inicia ngrok para el backend
   ngrok http 4000
   
   # Terminal 3: Inicia ngrok para el frontend (si necesitas HTTPS)
   ngrok http 3000
   ```
   Luego configura en tu `.env`:
   ```env
   FRONTEND_URL=https://tu-id-ngrok-frontend.ngrok.io
   BACKEND_URL=https://tu-id-ngrok-backend.ngrok.io
   ```
   Y configura el webhook en Mercado Pago:
   - URL: `https://tu-id-ngrok-backend.ngrok.io/api/payments/webhook`
   - Eventos: `payments` o `payment`
5. **Importante para redirección automática (`auto_return`)**: 
   - Mercado Pago requiere URLs **HTTPS** para `auto_return` en producción
   - En desarrollo local, usa **ngrok** para obtener URLs HTTPS
   - Con URLs HTTP en localhost, el `auto_return` puede no funcionar correctamente

## Configuración de Variables de Entorno

### Backend (PPP-NEST)

Copia el archivo `.env.example` a `.env` y completa las credenciales:

```bash
cd PPP-NEST
cp .env.example .env
```

Luego edita `.env` y completa el `MERCADO_PAGO_ACCESS_TOKEN` con tu token completo.

### Frontend (ppp-front)

Copia el archivo `.env.example` a `.env.local`:

```bash
cd ppp-front
cp .env.example .env.local
```

## Notas Importantes:

- Para desarrollo, usa credenciales de **TEST**
- El access token completo tiene formato: `TEST-XXXXXX-XXXXXX-XXXXXX-XXXXXX`
- El webhook debe estar configurado para recibir notificaciones de cambios en el estado de los pagos
- Asegúrate de que `FRONTEND_URL` y `BACKEND_URL` estén correctamente configurados para los callbacks
- La aplicación está configurada para usar **Preferences API** (Checkout Pro) que redirige a Mercado Pago para completar el pago
