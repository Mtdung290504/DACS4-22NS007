/**
* - Tạo một class Model kế thừa từ Base class và cung cấp các chức năng để xây dựng giao diện động.
* @template T - Class cần kế thừa
* @param {new (...args: any[]) => T} Base - Class cần kế thừa
* @returns {new (...args: any[]) => Model & T} Trả về class Model sau khi kế thừa `Base`
*/
export default function ModelMixin(Base = class { }) {
    /**
     * - Class Model hỗ trợ việc quản lý view dựa trên ngữ cảnh. 
     * - Cho phép tạo các phần tử HTML hoặc chuỗi HTML dựa trên ngữ cảnh hiện tại.
     * @class
     */
    class Model extends Base {
        #context = 'default';

        /**
         * - Các HTML string builder cho từng ngữ cảnh.
         * @type {{[context: string]: (self: this) => string}}
         */
        #HTMLStrings = {};

        /**
         * - Các HTML element builder cho từng ngữ cảnh.
         * @type {{[context: string]: (self: this) => HTMLElement}}
         */
        #HTMLElements = {};

        /**
         * - Đặt ngữ cảnh để lấy các view tương ứng.
         * @param {string} context - Tên ngữ cảnh.
         * @returns {this} Trả về chính đối tượng, hỗ trợ chaining method.
         */
        inContext(context = 'default') {
            this.#context = context;
            return this;
        }

        /**
         * - Lấy HTML string tương ứng với ngữ cảnh hiện tại.
         * @returns {string} - HTML string cho ngữ cảnh.
         * @throws {Error} Khi không có builder cho ngữ cảnh hiện tại.
         */
        getHTMLString() {
            const HTMLStringBuilder = this.#HTMLStrings[this.#context];

            if (HTMLStringBuilder) {
                return HTMLStringBuilder(this);
            }

            throw new Error('`HTMLStringBuilder` for this context not implemented');
        }

        /**
         * - Lấy phần tử HTML tương ứng với ngữ cảnh hiện tại.
         * @returns {HTMLElement} - Phần tử HTML cho ngữ cảnh.
         * @throws {Error} Khi không có builder cho ngữ cảnh hiện tại.
         */
        getHTMLElement() {
            const HTMLElementBuilder = this.#HTMLElements[this.#context];

            if (HTMLElementBuilder) {
                return HTMLElementBuilder(this);
            }

            throw new Error('`HTMLElementBuilder` for this context not implemented');
        }

        /**
         * - Đăng ký một hàm builder cho ngữ cảnh hiện tại, khi `getHTMLString` được gọi trong ngữ cảnh hiện tại sẽ kích hoạt nó để lấy kết quả.
         * @param {(self: this) => string} HTMLStringBuilder - Hàm builder cho HTML string.
         * @returns {this} Trả về chính đối tượng, hỗ trợ chaining method.
         */
        onGetHTMLStringCall(HTMLStringBuilder) {
            if (this.#HTMLStrings[this.#context]) {
                console.warn('Overridden `HTMLStringBuilder` set for this context.');
            }
            this.#HTMLStrings[this.#context] = HTMLStringBuilder;
            return this;
        }

        /**
         * - Đăng ký một hàm builder cho ngữ cảnh hiện tại, khi `getHTMLElement` được gọi trong ngữ cảnh hiện tại sẽ kích hoạt nó để lấy kết quả.
         * @param {(self: this) => HTMLElement} HTMLElementBuilder - Hàm builder cho HTMLElement.
         * @returns {this} Trả về chính đối tượng, hỗ trợ chaining method.
         */
        onGetHTMLElementCall(HTMLElementBuilder) {
            if (this.#HTMLElements[this.#context]) {
                console.warn('Overridden `HTMLElementBuilder` set for this context.');
            }
            this.#HTMLElements[this.#context] = HTMLElementBuilder;
            return this;
        }
    }

    return Model;
}