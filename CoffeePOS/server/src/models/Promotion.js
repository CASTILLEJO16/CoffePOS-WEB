import mongoose from 'mongoose';

const PromotionSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false,
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
    required: function() { return this.tipo === 'BUY_X_PAY_Y'; },
    min: 1
  },
  cantidadPagar: {
    type: Number,
    required: function() { return this.tipo === 'BUY_X_PAY_Y'; },
    min: 1
  },
  descuentoPorcentaje: {
    type: Number,
    required: function() { return this.tipo === 'PERCENTAGE_DISCOUNT'; },
    min: 0,
    max: 100
  },
  descuentoFijo: {
    type: Number,
    required: function() { return this.tipo === 'FIXED_DISCOUNT'; },
    min: 0
  },
  productosCombo: [{
    producto_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    nombre: {
      type: String,
      required: true
    },
    cantidad: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    }
  }],
  precioCombo: {
    type: Number,
    required: function() { return this.tipo === 'COMBO'; },
    min: 0
  },
  descripcion: {
    type: String,
    default: ''
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