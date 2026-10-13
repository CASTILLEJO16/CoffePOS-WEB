# Integración con Apple Wallet y Google Wallet - Documentación

## Resumen

Esta documentación explica cómo configurar la integración real de las tarjetas de lealtad con Apple Wallet y Google Wallet. La estructura del código ya está implementada, pero requiere credenciales y certificados oficiales para funcionar en producción.

## Apple Wallet (iOS)

### Requisitos Previos

1. **Cuenta de Desarrollador Apple**
   - Necesitas una cuenta de desarrollador Apple (Individual o Enterprise)
   - Costo: $99 USD/año para Individual, $299 USD/año para Enterprise

2. **Certificado Wallet**
   - Generar un certificado de tipo "Apple Wallet" en el Apple Developer Portal
   - El certificado debe estar firmado por Apple

3. **Pass Type ID**
   - Crear un Pass Type ID en el Apple Developer Portal
   - Formato: `pass.com.tuempresa.loyalty`
   - Este ID identifica tu tipo de pase de manera única

### Configuración

#### 1. Generar Certificado

```bash
# En tu terminal (Mac o Linux con OpenSSL)
openssl genrsa -out passCertificate.key 2048
openssl req -new -sha256 -key passCertificate.key -out CSR.csr
```

- Sube el CSR al Apple Developer Portal
- Descarga el certificado firmado (`.cer`)
- Convierte a PEM:
```bash
openssl x509 -in passCertificate.cer -inform DER -out passCertificate.pem
```

#### 2. Configurar Pass Type ID

En el Apple Developer Portal:
1. Ve a "Certificates, Identifiers & Profiles"
2. Crea un nuevo "Pass Type ID"
3. ID: `pass.com.tuempresa.loyalty`
4. Habilita "Wallet" capability

#### 3. Implementación en el Backend

El código ya tiene la estructura para generar pases de Wallet. Necesitas:

**Archivo: `server/src/services/walletService.js`** (por crear)

```javascript
import crypto from 'crypto';
import fs from 'fs';

export async function generateApplePass(loyaltyCard, businessInfo) {
  // 1. Crear el archivo pass.json con los datos de la tarjeta
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.com.tuempresa.loyalty',
    teamIdentifier: 'TU_TEAM_ID_DE_APPLE',
    organizationName: businessInfo.businessName,
    description: 'Tarjeta de Lealtad',
    logoText: businessInfo.businessName,
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(102, 126, 234)',
    labelColor: 'rgb(255, 255, 255)',
    storeCard: {
      headerFields: [
        { key: 'program', label: 'PROGRAMA', value: 'Lealtad' }
      ],
      primaryFields: [
        { key: 'name', label: 'CLIENTE', value: loyaltyCard.customer?.nombre }
      ],
      secondaryFields: [
        { key: 'stamps', label: 'SELLOS', value: `${loyaltyCard.sellos_actuales}/${loyaltyCard.sellos_requeridos}` }
      ],
      backFields: [
        { key: 'phone', label: 'TELÉFONO', value: loyaltyCard.customer?.telefono },
        { key: 'rewards', label: 'RECOMPENSAS', value: loyaltyCard.recompensas_disponibles }
      ],
      barcode: {
        format: 'PKBarcodeFormatQR',
        message: loyaltyCard.qr_token,
        messageEncoding: 'iso-8859-1'
      }
    }
  };

  // 2. Crear el archivo .pkpass (archivo ZIP firmado)
  // Esto requiere las librerías de Apple o implementación manual
  
  // 3. Firmar el pase con el certificado
  // 4. Devolver el archivo .pkpass para descargar
  
  return passData;
}
```

#### 4. Variables de Entorno

Agregar al archivo `server/.env`:

```env
# Apple Wallet
APPLE_TEAM_ID=tu_team_id
APPLE_PASS_TYPE_ID=pass.com.tuempresa.loyalty
APPLE_CERT_PATH=/path/to/passCertificate.pem
APPLE_KEY_PATH=/path/to/passCertificate.key
APPLE_WWDR_CERT_PATH=/path/to/AppleWWDRCA.pem
```

### Flujo de Actualización

Cuando se agrega un sello o se canjea una recompensa:

1. El backend genera un nuevo pase con los datos actualizados
2. El pase se firma con el certificado de Apple
3. Se envía al dispositivo del cliente via push notification (Apple Push Notification Service)
4. El Wallet actualiza automáticamente el pase

## Google Wallet (Android)

### Requisitos Previos

1. **Cuenta de Desarrollador Google**
   - Necesitas una cuenta de Google Cloud
   - Proyecto en Google Cloud Console

2. **Google Wallet API**
   - Habilitar la API de Google Wallet en tu proyecto
   - Configurar OAuth 2.0

3. **Issuer ID**
   - Obtener el Issuer ID desde Google Wallet Console
   - Este ID identifica tu empresa en Google Wallet

### Configuración

#### 1. Crear Clase de Wallet

En Google Wallet Console:
1. Ve a "Google Pay & Wallet Console"
2. Crea una nueva "Class"
3. Tipo: "Loyalty Class"
4. Define los campos de la tarjeta

#### 2. Implementación en el Backend

**Archivo: `server/src/services/googleWalletService.js`** (por crear)

```javascript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export async function generateGoogleWalletObject(loyaltyCard, businessInfo) {
  // 1. Configurar autenticación con Google
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  // 2. Crear el objeto de lealtad
  const loyaltyObject = {
    id: `${process.env.GOOGLE_ISSUER_ID}.${loyaltyCard._id}`,
    classId: `${process.env.GOOGLE_ISSUER_ID}.loyalty_class`,
    heroImage: {
      sourceUri: { uri: businessInfo.logoUrl }
    },
    textModulesData: [
      {
        header: 'Programa',
        body: 'Lealtad'
      },
      {
        header: 'Sellos',
        body: `${loyaltyCard.sellos_actuales}/${loyaltyCard.sellos_requeridos}`
      }
    ],
    barcode: {
      type: 'QR_CODE',
      value: loyaltyCard.qr_token
    },
    accountHolderName: loyaltyCard.customer?.nombre,
    loyaltyPoints: {
      label: 'Sellos',
      balance: {
        int: loyaltyCard.sellos_actuales
      }
    }
  };

  // 3. Usar la API de Google Wallet para crear el objeto
  const wallet = google.walletobjects({ version: 'v1', auth });
  
  const response = await wallet.loyaltyclass.insert({
    resourceId: `${process.env.GOOGLE_ISSUER_ID}.loyalty_class`,
    requestBody: loyaltyObject
  });

  return response.data;
}

export async function generateJwtForGoogleWallet(loyaltyCardId) {
  // Generar JWT firmado para el enlace "Add to Google Wallet"
  // Este JWT contiene la información del objeto de lealtad
  
  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    payload: {
      loyaltyObjects: [
        {
          id: `${process.env.GOOGLE_ISSUER_ID}.${loyaltyCardId}`
        }
      ]
    }
  };

  // Firmar con la clave privada del service account
  // Devolver el JWT
}
```

#### 3. Variables de Entorno

Agregar al archivo `server/.env`:

```env
# Google Wallet
GOOGLE_ISSUER_ID=tu_issuer_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY_PATH=/path/to/service-account-key.json
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/callback
```

### Flujo de Actualización

Google Wallet soporta actualizaciones automáticas:

1. Configurar webhooks en Google Wallet Console
2. Cuando hay cambios, Google hace un request a tu webhook
3. Tu webhook responde con los datos actualizados
4. Google actualiza el pase en el dispositivo del usuario

## Implementación en el Frontend

### Botón "Agregar a Apple Wallet"

```jsx
<button onClick={handleAddToAppleWallet} className="wallet-btn apple">
  <img src="/apple-wallet-logo.svg" alt="Apple Wallet" />
  Agregar a Apple Wallet
</button>

async function handleAddToAppleWallet() {
  try {
    const response = await api.get(`/loyalty/apple-wallet/${card._id}`);
    // response.data contiene el archivo .pkpass
    const blob = new Blob([response.data], { type: 'application/vnd.apple.pkpass' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lealtad.pkpass';
    a.click();
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Botón "Agregar a Google Wallet"

```jsx
<button onClick={handleAddToGoogleWallet} className="wallet-btn google">
  <img src="/google-wallet-logo.svg" alt="Google Wallet" />
  Agregar a Google Wallet
</button>

async function handleAddToGoogleWallet() {
  try {
    const response = await api.get(`/loyalty/google-wallet/${card._id}`);
    // response.data contiene el JWT o el enlace
    window.open(response.data.url, '_blank');
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Pruebas en Desarrollo

### Apple Wallet

Para probar sin certificados de producción:
1. Usa el "Apple Wallet Simulator" en Xcode
2. O genera pases de prueba con certificados de desarrollo

### Google Wallet

Para pruebas:
1. Usa el "Google Wallet API Sandbox"
2. No requiere certificados reales para pruebas

## Resumen de Archivos a Crear

1. `server/src/services/walletService.js` - Servicio para Apple Wallet
2. `server/src/services/googleWalletService.js` - Servicio para Google Wallet
3. `server/src/routes/walletRoutes.js` - Rutas para generar pases
4. Agregar rutas a `server/src/server.js`
5. Configurar variables de entorno

## Notas Importantes

- **Nunca** incluir claves privadas o certificados en el repositorio
- **Nunca** exponer credenciales en el frontend
- Usar variables de entorno para todas las credenciales sensibles
- Los certificados deben renovarse periódicamente (Apple: 1 año)
- Google Wallet requiere aprobación de Google para producción

## Soporte

Para más información:
- Apple Wallet: https://developer.apple.com/passbook/
- Google Wallet: https://developers.google.com/wallet
