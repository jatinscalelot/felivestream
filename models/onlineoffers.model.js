let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let product_links_Schema = new mongoose.Schema({
	platform: { 
        type: mongoose.Types.ObjectId,
		required: true
    },
	product_link : {
		type: String,
		trim: true,
		required: true
	},
	short_link_id : {
		type: mongoose.Types.ObjectId,
		required: true
	}
}, { _id: false });
let schema = new mongoose.Schema({
	product_links : [product_links_Schema],
	createdBy: {
		type: mongoose.Types.ObjectId,
		default: null
	},
	updatedBy: {
		type: mongoose.Types.ObjectId,
		default: null
	},
	is_approved : {
		type: Boolean,
		default: false
	}
}, { timestamps: true, strict: false, autoIndex: true });
schema.plugin(mongoosePaginate);
module.exports = schema;