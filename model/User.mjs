import ModelMixin from "./ModelMixin.mjs";

/**
 * - Abstract class chứa các hành động của User. 
 * - Class này cần được kế thừa và triển khai các phương thức cần được thực hiện trong lớp con.
 * @abstract
 * @class
 */
class UserActions {
    /**
     * - Đăng ký
     * @abstract
     */
    register() { }

    /**
     * - Đăng nhập
     * @abstract
     */
    login() { }

    /**
     * - Cập nhật thông tin
     * @abstract
     */
    setInfo() { }
}

/**
 * - Class đại diện cho người dùng, chứa thông tin về người dùng và các hành vi.
 * @class
 */
export default class User extends ModelMixin(UserActions) {
    info = {
        'uid': '',
        'name': '',
        'account': {
            'username': '',
            'password': '',
        }
    };

    /**
     * @param {keyof typeof this.info} key 
     * @param {typeof this.info[key]} value 
     * @returns {this}
     */
    setInfo(key, value) {
        this.info[key] = value;
        return this;
    }
}