const {MVLoaderBase} = require('mvloader');
const {Op} = require('sequelize');
/**
 * @class BotToDBController
 *
 * @property {MVLoader}
 * @property {Object<import('mvtools)>} MT
 * @property {Object<import('botcms')>} Bot
 * @property {Object<import('mvl-db-handler').Sequelize>} DB
 * @property {Model} Model
 * @property
 */
class BotToDBController extends MVLoaderBase {
    caption = '';
    fields = {
        equals: [],
        list: ['id', 'name'],
    };
    modelName = '';

    constructor (App, ...configs) {
        let defaults = {
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
                export_started: 'common.msg.export_started',
                import_started: 'common.msg.import_started',
                field_caption: field => 'common.fieldNames.' + field,
                btn_menu_main: 'common.btn.menu.main',
            },
            path: {
                answers_single_query: 'answers.manage_objects.query.answer',
                answers_add: 'answers.manage_objects_add',
                answers_selected: 'answers.manage_objects.selected.answer',
                after_add: 'c.manage',
                main: 'c.main',
            },
        };
        super(defaults, ...configs);
        this.App = App;
        this.MT = this.App.MT;
    }

    initFinish () {
        this.loadConfig({
            lexicons: {
                export_finished: this.caption + '.msg.export_finished',
                import_finished: this.caption + '.msg.import_finished',
                field_caption: field => this.caption + '.fieldNames.' + field,
            }
        });
        this.Bot = this.App.ext.handlers[this.config.BotHandler].Bot;
        this.DB = this.App.DB;
        this.Model = this.DB.models[this.modelName];
        this.IEC = this.App.ext.controllers.mvlbaImportExportController;
    }

    fieldsCaptions (ctx) {
        let captions = {byField: {}, byCaption: {}};
        for (let field of this.fields.list) {
            captions.byField[field] = ctx.lexicon(this.config.lexicons.field_caption(field));
        }
        captions.byCaption = this.MT.flipObject(captions.byField);
        // console.log('FIELDS CAPTIONS: ', captions);
        return captions;
    }

    getAll_act = (ctx) => {
        this.Model.findAll(this.prepareGetCriteria({}))
            .then(contractors => {
                let kb = this.newKB(ctx);
                for (let contractor of contractors) {
                    kb.addBtn(contractor[this.config.fields.singleButton]);
                }
                let parcel = this.newParcel();
                parcel.message = ctx.lexicon(this.config.lexicons.choose_from_list);
                parcel.keyboard = kb.addBtnMenuManage().addBtnMenuMain().build();
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

    list_act = (ctx, query = null) => {
        let q = this.MT.extract(this.config.path.answers_single_query, ctx.session);
        let criteria = {
            where: {},
            limit: 12,
        };
        query = this.MT.isString(query) ? query : ctx.msg;
        if (!this.MT.empty(query) && query !== {}) {
            criteria.where[this.config.fields.singleButton] = {[Op.like]: '%' + (query || '') + '%',};
        }
        return this.Model.findAll(this.prepareGetCriteria(criteria))
            .then(contractors => {
                let kb = this.newKB(ctx);
                for (let contractor of contractors) {
                    kb.addBtn(contractor[this.config.fields.singleButton]);
                }
                let parcel = this.newParcel();
                parcel.message = ctx.lexicon(this.config.lexicons.choose_from_list);
                parcel.keyboard = kb.addBtnMenuManage().addBtnMenuMain().build();
                ctx.reply(parcel);
            });
    };

    listAll_act = async (ctx) => this.list_act(ctx, '');

    add_act = async (ctx) => {
        let contractor = this.setDefaultKeys({}, ctx);
        let answers = this.MT.extract(this.config.path.answers_add, ctx.session);
        for (let key in answers) {
            if (answers.hasOwnProperty(key)) {
                contractor[key] = answers[key].answer;
            }
        }
        if (this.IEC) {
            contractor = this.MT.merge(contractor, await this.IEC.addIdsFromValues(this.fields.equals, contractor));
        }
        this.Model.create(contractor)
            .then(async created => {
                if (!this.MT.empty(created)) {
                    created = await this.setAdditionalObjects(created, ctx);
                    let parcel = this.newParcel();
                    let values = created.get();
                    if (this.IEC) {
                        values = await this.IEC.addValuesFromIds(this.fields.equals, values);
                    }
                    parcel.message = ctx.lexicon(this.config.lexicons.details, await this.prepareViewData(values, ctx));
                    ctx.reply(parcel);
                    let step = ctx.BC.Scripts.extract(this.config.path.after_add);
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
            let kb = this.newKB(ctx);
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

    export_act = async (ctx, params = {}) => {
        let parcel = this.newParcel();
        parcel.message = ctx.lexicon(this.config.lexicons.export_started);
        ctx.reply(parcel);
        let filename = await this.IEC.export(this.Model, {}, this.fields, {
            captions: this.fieldsCaptions(ctx),
            filename: this.config.exportFilename,
        });
        parcel = this.newParcel();
        parcel.attachments[this.Bot.ATTACHMENTS.FILE] = [{source: filename}];
        parcel.message = ctx.lexicon(this.config.lexicons.export_finished);
        ctx.reply(parcel);
    };

    prepareViewData (object, ctx) {
        return object;
    }

    prepareGetCriteria (criteria) {
        return criteria;
    }

    setDefaultKeys (object = {}, ctx) {
        return object;
    }

    async setAdditionalObjects (object, ctx) {
        return object;
    }

    valuesFromAnswers (ctx, thread) {
        let values = {};
        let answers = this.MT.extract(this.config.path.answers_add, ctx.session);
        for (let key in answers) {
            if (answers.hasOwnProperty(key)) {
                values[key] = answers[key].answer;
            }
        }
        return values;
    }

    getCurrentMvlUser = (ctx) => ctx.singleSession.mvlUser || null;

    newParcel = (content = {}) => new this.Bot.config.classes.Parcel(content);

    newKB = async (ctx, kbObject = {}) => await (new this.App.ext.handlers.BotHandler.Bot.config.classes.Keyboard(ctx)).fromKBObject(kbObject);

}

module.exports = BotToDBController;