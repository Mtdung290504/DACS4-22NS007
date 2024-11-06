import AbstractDatabase from "./database/AbstractDatabase.js";
import DatabaseMySQL from "./database/DatabaseMySQL.js";

const database = AbstractDatabase.createImplDatabase(DatabaseMySQL);
const [ id, name, role ] = await database.login('a', 'b');