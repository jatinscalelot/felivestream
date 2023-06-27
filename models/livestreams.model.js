let mongoose = require("mongoose");
let mongoosePaginate = require("mongoose-paginate-v2");
let schema = new mongoose.Schema({
    event_name : {
        type: String,
		trim: true,
		required: true,
    },
    event_category : {
        type: mongoose.Types.ObjectId,
		default: null
    },
    event_description : {
        type: String,
		trim: true,
        default: ''
    },
    event_date : {
        type: String,
		required: true
    },
    event_start_time : {
        type: String,
		required: true
    },
    event_end_time : {
        type: String,
		required: true
    },
    event_type : {
        type: String,
        enum: ['free', 'paid']
    },
    price_per_user : {
        type: Number,
        default: 0
    },
    photos : [],
    videos : [],
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