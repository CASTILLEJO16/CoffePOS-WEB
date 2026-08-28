/**
 * Modelo de Usuario (Mongoose)
 * Define la estructura y operaciones básicas para usuarios
 */

import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  nombre: {
    type: String,
    required: true
  },
  usuario: {
    type: String,
    required: true
  },
  contraseña_hash: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    enum: ['admin', 'cajero'],
    default: 'cajero'
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto único para usuario + clientId
UserSchema.index({ usuario: 1, clientId: 1 }, { unique: true });

// Método para verificar contraseña
UserSchema.methods.verifyPassword = function(password) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compareSync(password, this.contraseña_hash);
};

// Método para JSON sin contraseña
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.contraseña_hash;
  return obj;
};

export default mongoose.model('User', UserSchema);
