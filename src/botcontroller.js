const MVLoaderBase = require('mvloader/src/mvloaderbase');
const Keyboard = require('botcms/lib/keyboard');
const {Op} = require('sequelize');
/**
 * @class BotToDBController
 *
 * @property {MVLoader}
 * @property {MVTools}
 * @property {BotCMS} Bot
 * @property {Sequelize} DB
 * @property {Model} Model
 * @property
 */
class BotToDBController extends MVLoaderBase {
    caption = '';
    defaults = {
        BotHandler: 'BotHandler',
        fields: {
            singleButton: 'name',
        },
        keyboards: {
            manage_object: 'manage_object',
        },
        lexicons: {
            choose_from_list: 'common.msg.action.choose_from_list',
            details: 'common.msg.details',
        },
        path: {
            answers_single_query: 'answers.manage_objects.query.answer',
            answers_add: 'answers.manage_objects_add',
            answers_selected: 'answers.manage_objects.selected.answer',
            manage: 'c.manage',
        },
    };
    modelName = '';

    constructor (App, config = {}) {
        super(config);
        this.App = App;
        this.MT = this.App.MT;
    }

    initFinish () {
        this.Bot = this.App.ext.handlers[this.config.BotHandler].Bot;
        this.DB = this.App.DB;
        this.Model = this.DB.models[this.modelName];
    }

    getAll = (ctx) => {
        this.Model.findAll(this.prepareGetCriteria({}))
            .then(contractors => {
                let parcel = this.newParcel();
                parcel.message = JSON.stringify(contractors, null, 4);
                parcel.keyboard = (new Keyboard(ctx)).addBtnMenuMain().addBtnBack().build();
                ctx.reply(parcel);
            });
    };

    find_vld = (ctx) => {
        // console.log('MVLBA MESSAGE: ' + ctx.msg);
        // console.log('MVLBA CRITERIA: ', criteria);
        // console.log();
        let criteria = {
            where: {},
            limit: 12,
        };
        criteria.where[this.config.fields.singleButton] = {[Op.like]: '%' + ctx.msg + '%',};
        return this.Model.count(this.prepareGetCriteria(criteria))
            .then(count => count > 0);
    };

    list_act = (ctx) => {
        let q = this.MT.extract(this.config.path.answers_single_query, ctx.session);
        let criteria = {
            where: {},
            limit: 12,
        };
        criteria.where[this.config.fields.singleButton] = {[Op.like]: '%' + ctx.msg + '%',};
        return this.Model.findAll(this.prepareGetCriteria(criteria))
            .then(contractors => {
                let kb = new Keyboard(ctx);
                for (let contractor of contractors) {
                    kb.addBtn(contractor[this.config.fields.singleButton]);
                }
                let parcel = this.newParcel();
                parcel.message = ctx.lexicon(this.config.lexicons.choose_from_list);
                parcel.keyboard = kb.addBtnMenuManage().addBtnMenuMain().build();
                ctx.reply(parcel);
            });
    };

    add_act = async (ctx) => {
        let contractor = this.setDefaultKeys({});
        let answers = this.MT.extract(this.config.path.answers_add, ctx.session);
        for (let key in answers) {
            if (answers.hasOwnProperty(key)) {
                contractor[key] = answers[key].answer;
            }
        }
        this.Model.create(contractor)
            .then(async created => {
                console.log(created);
                if (!this.MT.empty(created)) {
                    let parcel = this.newParcel();
                    parcel.message = ctx.lexicon(this.config.lexicons.details, await this.prepareViewData(created.get(), ctx));
                    ctx.reply(parcel);
                    let step = ctx.BC.Scripts.extract(this.config.path.manage);
                    return ctx.BC.doUpdate(step, ctx);
                }
            });
    };

    singleManageActions_act = async (ctx) => {
        let q = this.MT.extract(this.config.path.answers_selected, ctx.session);
        let criteria = {where: {}};
        criteria.where[this.config.fields.singleButton] = q;
        let contractor = await this.Model.findOne(this.prepareGetCriteria(criteria));
        // contractor.get()
        if (!this.MT.empty(contractor)) {
            let kb = new Keyboard(ctx);
            let parcel = this.newParcel();
            parcel.message = ctx.lexicon(this.config.lexicons.details, await this.prepareViewData(contractor.get(), ctx));
            parcel.keyboard = kb.fromKBObject(ctx.BC.keyboards[this.config.keyboards.manage_object] || {}).build();
            ctx.reply(parcel);
        }
    };

    enableDisable_act = async (ctx) => {
        let q = this.MT.extract(this.config.path.answers_selected, ctx.session);
        let criteria = {where: {}};
        criteria.where[this.config.fields.singleButton] = q;
        let contractor = await this.Model.findOne(this.prepareGetCriteria(criteria));
        // contractor.get()
        if (!this.MT.empty(contractor)) {
            contractor.active = !contractor.active;
            contractor.save();
        }
    };

    async prepareViewData (object, ctx) {
        return object;
    }

    prepareGetCriteria (criteria) {
        return criteria;
    }

    setDefaultKeys (object) {
        return object;
    }

    newParcel = () => new this.Bot.config.classes.Parcel();

}

module.exports = BotToDBController;