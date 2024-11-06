import AbstractDatabase from "./AbstractDatabase.js";

/**
 * @class
 * @extends {AbstractDatabase}
 * @typedef {typeof AbstractDatabase.prototype} Super
 */
export default class DatabaseMySQL extends AbstractDatabase {
    /**
     * @type {Super['login']}
     */
    async login(userName, hassedPassword) {
        console.log(userName, hassedPassword);
    }
}