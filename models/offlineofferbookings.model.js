let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let schema = new mongoose.Schema({
	userid:{
		type: mongoose.Types.ObjectId,
		require: true
	},
	offerid : {
		type: mongoose.Types.ObjectId,
		require: true
	},
    shopid : {
        type: mongoose.Types.ObjectId,
		require: true
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
module.exports = schema;