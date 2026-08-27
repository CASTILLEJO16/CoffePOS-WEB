import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  license: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'License',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  deviceName: {
    type: String,
    trim: true
  },
  os: {
    type: String,
    trim: true
  },
  browser: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'released'],
    default: 'active'
  },
  lastActivated: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Device', deviceSchema);
