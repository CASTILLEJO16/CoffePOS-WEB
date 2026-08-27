import mongoose from 'mongoose';

const licenseSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  licenseKey: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['trial', 'subscription', 'lifetime'],
    default: 'trial'
  },
  duration: {
    type: Number, // días
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'blocked', 'pending'],
    default: 'active'
  },
  maxDevices: {
    type: Number,
    default: 1
  },
  devicesUsed: {
    type: Number,
    default: 0
  },
  signature: {
    type: String, // firma digital
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

licenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('License', licenseSchema);
