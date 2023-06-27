let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let schema = new mongoose.Schema({
	shop_category : {
		type: mongoose.Types.ObjectId,
		default: null
	},
	location: {
		type: {
			type: String,
			enum: ['Point']
		},
		coordinates: {
			type: [Number]
		}
	},
	is_approved : {
		type: Boolean,
		default: false
	},
	createdBy: {
		type: mongoose.Types.ObjectId,
		default: null
	},
	updatedBy: {
		type: mongoose.Types.ObjectId,
		default: null
	}
}, { timestamps: true, strict: false, autoIndex: true });
schema.plugin(mongoosePaginate);
schema.index({ "location" : "2dsphere" });
module.exports = schema;