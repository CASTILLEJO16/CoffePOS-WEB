/**
 * Script de diagnóstico para verificar el estado de cajas de un usuario
 * Uso: node scripts/diagnose_caja.js <nombre_usuario>
 * Ejemplo: node scripts/diagnose_caja.js "dev coffee"
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import CashRegister from '../src/models/CashRegister.js';

// Cargar variables de entorno
dotenv.config();

// Obtener MONGODB_URI directamente de las variables de entorno
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;

const USERNAME = process.argv[2];

if (!USERNAME) {
  console.error('❌ Error: Debes proporcionar el nombre de usuario');
  console.log('Uso: node scripts/diagnose_caja.js <nombre_usuario>');
  console.log('Ejemplo: node scripts/diagnose_caja.js "dev coffee"');
  process.exit(1);
}

async function diagnose() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar usuario
    console.log(`\n👤 Buscando usuario: "${USERNAME}"`);
    const user = await User.findOne({ 
      usuario: USERNAME.toLowerCase(),
      activo: true 
    });

    if (!user) {
      console.log('❌ Usuario no encontrado o inactivo');
      process.exit(1);
    }

    console.log('✅ Usuario encontrado:');
    console.log('   - ID:', user._id);
    console.log('   - Usuario:', user.usuario);
    console.log('   - Nombre:', user.nombre);
    console.log('   - Rol:', user.rol);
    console.log('   - ClientId:', user.clientId || 'Sin asignar');

    // Buscar todas las cajas del usuario
    console.log(`\n💼 Buscando todas las cajas del usuario...`);
    const allCashRegisters = await CashRegister.find({ 
      usuario_id: user._id 
    })
    .populate('usuario_id', 'nombre')
    .sort({ fecha_apertura: -1 });

    console.log(`📊 Total de cajas encontradas: ${allCashRegisters.length}`);

    if (allCashRegisters.length === 0) {
      console.log('⚠️  El usuario no tiene ninguna caja registrada');
      console.log('💡 Solución: El usuario debe abrir una caja desde la pantalla de apertura de caja');
    } else {
      console.log('\n📋 Listado de cajas:');
      allCashRegisters.forEach((caja, index) => {
        console.log(`\n   ${index + 1}. Caja #${caja._id}`);
        console.log('      - Nombre:', caja.nombre_caja || 'Sin nombre');
        console.log('      - Estado:', caja.estado);
        console.log('      - Apertura:', caja.fecha_apertura);
        console.log('      - Cierre:', caja.fecha_cierre || 'No cerrada');
        console.log('      - Fondo inicial:', caja.fondo_inicial);
        console.log('      - Ventas efectivo:', caja.ventas_efectivo);
      });

      // Buscar caja abierta
      console.log('\n🔍 Buscando caja ABIERTA...');
      const openCashRegister = await CashRegister.findOne({
        usuario_id: user._id,
        estado: 'abierta'
      })
      .populate('usuario_id', 'nombre')
      .sort({ fecha_apertura: -1 })
      .limit(1);

      if (openCashRegister) {
        console.log('✅ Caja abierta encontrada:');
        console.log('   - ID:', openCashRegister._id);
        console.log('   - Nombre:', openCashRegister.nombre_caja);
        console.log('   - Estado:', openCashRegister.estado);
        console.log('   - Apertura:', openCashRegister.fecha_apertura);
        console.log('   - Cliente ID:', openCashRegister.clientId);
      } else {
        console.log('❌ No hay caja abierta');
        console.log('💡 Solución: El usuario debe abrir una caja desde /apertura-caja');
      }
    }

    // Verificar si hay cajas abiertas con el mismo nombre para el mismo clientId
    if (user.clientId) {
      console.log('\n🔍 Verificando cajas abiertas con el mismo nombre en esta cafetería...');
      const openRegistersByClient = await CashRegister.find({
        clientId: user.clientId,
        estado: 'abierta'
      }).populate('usuario_id', 'nombre usuario');

      if (openRegistersByClient.length > 0) {
        console.log(`📊 Cajas abiertas en esta cafetería (${user.clientId}): ${openRegistersByClient.length}`);
        openRegistersByClient.forEach((caja, index) => {
          console.log(`   ${index + 1}. ${caja.nombre_caja || 'Sin nombre'} - Usuario: ${caja.usuario_id?.usuario} (${caja.usuario_id?.nombre})`);
        });
      } else {
        console.log('📊 No hay cajas abiertas en esta cafetería');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

diagnose();
