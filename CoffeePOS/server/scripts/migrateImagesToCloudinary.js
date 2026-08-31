/**
 * Script para migrar imágenes locales a Cloudinary
 * Ejecutar con: node scripts/migrateImagesToCloudinary.js
 */

import dotenv from 'dotenv';
import { connectDB } from '../src/config/database.js';
import Product from '../src/models/Product.js';
import cloudinary from '../src/config/cloudinary.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateImages() {
  try {
    console.log('🚀 Iniciando migración de imágenes a Cloudinary...');
    
    // Conectar a MongoDB
    await connectDB();
    console.log('✅ Conectado a MongoDB');

    // Buscar productos con imágenes locales
    const products = await Product.find({ 
      imagen: { $exists: true, $ne: null, $ne: '' },
      imagen: { $not: /cloudinary\.com/ }
    });

    console.log(`📦 Encontrados ${products.length} productos con imágenes locales`);

    let migrated = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const localPath = product.imagen.startsWith('/uploads/') 
          ? path.join(__dirname, '..', product.imagen)
          : path.join(__dirname, '..', 'uploads', product.imagen);

        // Verificar si el archivo existe
        if (!fs.existsSync(localPath)) {
          console.log(`⚠️  Archivo no encontrado: ${localPath}`);
          failed++;
          continue;
        }

        console.log(`📤 Subiendo imagen para: ${product.nombre}`);

        // Subir a Cloudinary
        const result = await cloudinary.uploader.upload(localPath, {
          folder: 'coffeepos/productos',
          transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });

        // Actualizar producto con la nueva URL
        product.imagen = result.secure_url;
        await product.save();

        console.log(`✅ ${product.nombre} - ${result.secure_url}`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrando ${product.nombre}:`, error.message);
        failed++;
      }
    }

    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Exitosos: ${migrated}`);
    console.log(`❌ Fallidos: ${failed}`);
    console.log(`📦 Total procesados: ${products.length}`);

    if (migrated > 0) {
      console.log('\n💡 Puedes eliminar la carpeta uploads/ después de verificar que todas las imágenes se migraron correctamente');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrateImages();
