import { applyMethodDecorators, requireImplementMethod } from "../client/utils/decorators.js";

/**
 * @abstract
 * @class
 */
export default class AbstractDatabase {
    constructor() {
        if (new.target === AbstractDatabase) {
            throw new Error("Cannot instantiate an abstract class");
        }
    }

    /**
     * @template {typeof AbstractDatabase} T - Class kế thừa từ AbstractDatabase
     * @param {T} ImplDatabaseClass - Một class kế thừa từ AbstractDatabase
     * @returns {T['prototype']} Instance của lớp kế thừa
     */
    static createImplDatabase(ImplDatabaseClass) {
        if (!(ImplDatabaseClass.prototype instanceof AbstractDatabase)) {
            throw new Error("Provided class must be a subclass of Database");
        }

        return new ImplDatabaseClass();
    }

    /**
     * @abstract
     * @param {string} userName 
     * @param {string} hassedPassword 
     * @returns {Promise<[ id: number, name: string, role: 'lecturer' | 'student' ]>}
     */
    async login(userName, hassedPassword) {}
}

applyMethodDecorators(AbstractDatabase, 'ALL_METHOD', requireImplementMethod);