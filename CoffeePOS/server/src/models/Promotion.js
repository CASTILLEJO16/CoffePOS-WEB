import mongoose from 'mongoose';

const PromotionSchema = new mongoose.Schema({
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
  tipo: {
    type: String,
    enum: ['BUY_X_PAY_Y', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'COMBO'],
    required: true
  },
  productosParticipantes: [{
    producto_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    nombre: {
      type: String,
      required: true
    }
  }],
  cantidadComprar: {
    type: Number,
    required: true,
    min: 1
  },
  cantidadPagar: {
    type: Number,
    required: true,
    min: 1
  },
  fechaInicio: {
    type: Date,
    required: true
  },
  fechaFinalizacion: {
    type: Date,
    required: true
  },
  horaInicio: {
    type: String,
    default: '00:00'
  },
  horaFinalizacion: {
    type: String,
    default: '23:59'
  },
  diasSemana: {
    type: [String],
    enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    default: []
  },
  estado: {
    type: String,
    enum: ['Activa', 'Inactiva'],
    default: 'Inactiva'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  usuarioAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Promotion', PromotionSchema);