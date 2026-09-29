const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 60 },
  position: { type: Number, required: true },
});

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    columns: [columnSchema],
  },
  { timestamps: true }
);

boardSchema.index({ members: 1 });

boardSchema.methods.hasMember = function hasMember(userId) {
  return this.members.some((m) => (m._id || m).toString() === userId.toString());
};

module.exports = mongoose.model('Board', boardSchema);
