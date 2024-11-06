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
     * @returns {AbstractDatabase} Instance của lớp kế thừa nhưng ép kiểu thành `AbstractDatabase` để chỉ gợi ý abstract method
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
    async login(userName, hassedPassword) {
        throw new Error('login is not implement yet');
    }
}