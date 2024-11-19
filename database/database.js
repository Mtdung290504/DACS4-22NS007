const { Account, Student, Lecturer, Class } = require('../classes/classes');
const mysql = require('mysql2/promise');
const bcrypt = require("bcrypt");
const saltRounds = 10;

class Database {
    constructor() {
        const config = {
            host: 'localhost',
            user: 'root',
            password: '123456',
            database: 'dacs3v0'
        }

        this.pool = mysql.createPool({
            ...config,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async lecturerSignUp(isLecturer, { userName, userLoginName, userPassword }) {
        try {
            userPassword = await bcrypt.hash(userPassword, saltRounds);
            const [resultSetHeader] = await this.pool.execute('CALL SIGNUP(?, ?, ?, ?, @student_id)', [isLecturer, userName, userLoginName, userPassword]);
            console.log('lecturerSignUp - ResultSetHeader:', resultSetHeader, '-----------------------------\n');

            return resultSetHeader.affectedRows == 1 ? true : false;
        } catch (error) {
            if (error.code === 'ER_SIGNAL_EXCEPTION') {
                throw new Error(error.sqlMessage);
            }
            throw error;
        }
    }

    async loginUser({ loginId, enteredPassword }) {
        try {
            const queryResult = await this.pool.query('CALL LOGIN(?)', [loginId]);
            console.log('loginUser - QueryResult:', queryResult, '-----------------------------\n');
            const resultSet = queryResult[0][0];
            
            if(resultSet.length == 0)
                throw new Error('Tên tài khoản không chính xác')

            const result = resultSet[0];
            const passwordIsCorrect = await new Account(result.id, result.user_login_id, result.password, enteredPassword).checkPassword();

            if(passwordIsCorrect) {
                const userData = [result.id, result.name, result.phone_number, result.email]
                if(result.is_lecturer == 1)
                    return new Lecturer(...userData);
                else
                    return new Student(...userData);
            }

            throw new Error('Mật khẩu không chính xác');
        } catch (error) {
            throw error;
        }
    }

    async createClass(lecturerId, className) {
        try {
            const queryResult = await this.pool.execute('CALL create_class(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('createClass - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            const { id, name } = queryResult[0][0][0];

            return { id, name };
        } catch (error) {
            throw error;
        }
    }

    async updateClassName(classId, newName) {
        try {
            const queryResult = await this.pool.execute('CALL update_class_name(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('updateClassName - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }
    }

    async getAllClass(userId, role) {
        try {
            const procedureCall = `CALL ${(role == 1) ? 'get_all_lecturer_classes' : 'get_all_student_classes'} (?)`;
            const queryResult = await this.pool.query(procedureCall, [userId]);

            console.log('getAllClass - QueryResult:', queryResult, '-----------------------------\n');
            return queryResult[0][0];
        } catch (error) {
            throw error;
        }
    }

    async createDocCategory(lecturerId, docCategoryName) {
        try {
            const queryResult = await this.pool.execute('CALL create_doc_category(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('createDocCategory - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            const { id, name } = queryResult[0][0][0];

            return { id, name };
        } catch (error) {
            throw error;
        }
    }

    async getAllDocCategoryAndDoc(lecturerId) {
        try {
            const queryResult = await this.pool.query('CALL get_all_doc_category_n_doc(?)', [lecturerId]);
            console.log('getAllDocCategoryAndDoc - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0];
        } catch (error) {
            throw error;
        }
    }

    async getAllDocByCategory(categoryId) {
        try {
            const queryResult = await this.pool.query('CALL get_all_doc_by_doc_category_id(?)', [categoryId]);
            console.log('getAllDocByCategory - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0];
        } catch (error) {
            throw error;
        }
    }

    async createDocAndAddToDocCategory(fileName, docCategoryId) {
        try {
            const queryResult = await this.pool.execute('CALL create_doc_n_add_to_doc_category(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('createDocAndAddToDocCategory - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            const { id, file_name } = queryResult[0][0][0];

            return { id, file_name };
        } catch (error) {
            throw error;
        }        
    }

    async changeNameOfDocCategory(docCategoryId, newName) {
        try {
            const queryResult = await this.pool.execute('CALL update_doc_category_name(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('changeNameOfDocCategory - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }        
    }

    async deleteDocCategory(docCategoryId) {
        try {
            const queryResult = await this.pool.execute('CALL delete_doc_category(?)', [docCategoryId]);
            const [resultSetHeader] = queryResult;
            console.log('deleteDocCategory - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }
    }

    async deleteDoc(docId) {
        try {
            const queryResult = await this.pool.execute('CALL delete_doc(?)', [docId]);
            const [resultSetHeader] = queryResult;
            console.log('deleteDoc - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }
    }

    async checkClassExistence(classId) {
        try {
            await this.pool.query('CALL check_class_existence(?)', [classId]);
        } catch (error) {
            if (error.code === 'ER_SIGNAL_EXCEPTION')
                throw new Error(error.sqlMessage);
            throw(error);
        }
    }

    async checkAccessToClass(userId, classId) {
        try {
            await this.pool.query('CALL check_access_to_class(?, ?)', [...arguments]);
        } catch (error) {
            if (error.code === 'ER_SIGNAL_EXCEPTION')
                throw new Error(error.sqlMessage);
            throw(error);
        }
    }
    
    async getClassNameAndMember(classId) {
        try {
            const queryResult = await this.pool.query('CALL get_class_members(?)', [classId]);
            console.log('getClassNameAndMember - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0][0];
        } catch (error) {
            throw error;
        }
    }

    async getClassAttachFiles(classId, lecturerId) {
        try {
            const queryResult = await this.pool.query('CALL get_class_attach_files(?, ?)', [...arguments]);
            console.log('getClassAttachFiles - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0];
        } catch (error) {
            throw error;
        }
    }

    async attachFileToClass(classId, docId) {
        try {
            const queryResult = await this.pool.execute('CALL attach_file_to_class(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('attachFileToClass - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            if(resultSetHeader.affectedRows == 1)
                return true;
            return false;
        } catch (error) {
            throw error;
        }
    }

    async removeAttachFileFromClass(classId, docId) {
        try {
            const queryResult = await this.pool.execute('CALL remove_attach_file_from_class(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('removeAttachFileFromClass - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            if(resultSetHeader.affectedRows == 1)
                return true;
            return false;
        } catch (error) {
            throw error;
        }       
    }

    async getAllClassMember(classId) {
        try {
            const queryResult = await this.pool.query('CALL get_all_student_of_class(?)', [classId]);
            console.log('getAllClassMember - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //id, login_id, name
        } catch (error) {
            throw error;
        }
    }

    async signUpAndAddStudentToClass(userName, userLoginId, userPassword, classId) {
        try {
            userPassword = await bcrypt.hash(userPassword, saltRounds);
            await this.pool.execute('CALL signup_n_add_student_to_class(?, ?, ?, ?)', [userName, userLoginId, userPassword, classId]);
        } catch (error) {
            if (error.code === 'ER_SIGNAL_EXCEPTION') {
                throw new Error(error.sqlMessage);
            }
            throw error;
        }
    }

    async addExercise(classId, exStart, exEnd, exName, exDes) {
        try {
            const queryResult = await this.pool.execute('CALL create_exercise(?, ?, ?, ?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('addExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            const { exercise_id } = queryResult[0][0][0];

            return exercise_id;
        } catch (error) {
            throw error;
        }
    }

    async updateExercise(exerciseId, exStart, exEnd, exName, exDes) {
        try {
            const queryResult = await this.pool.execute('CALL update_exercise(?, ?, ?, ?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('updateExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }
    }

    async resetExerciseAttachFile(exerciseId) {
        try {
            const queryResult = await this.pool.execute('CALL reset_exercise_attach_file(?)', [exerciseId]);
            const [resultSetHeader] = queryResult;
            console.log('resetExerciseAttachFile - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }
    }

    async attachFileToExercise(exerciseId, docId) {
        try {
            const queryResult = await this.pool.execute('CALL attach_file_to_exercise(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('attachFileToExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            if(resultSetHeader.affectedRows == 1)
                return true;
            return false;
        } catch (error) {
            throw error;
        }   
    }

    async getExerciseIds(classId) {
        try {
            const queryResult = await this.pool.query('CALL get_exercise_ids(?)', [classId]);
            console.log('getExerciseIds - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //id
        } catch (error) {
            throw error;
        }
    }

    async getExerciseInfoForLecturer(exerciseId) {
        try {
            const queryResult = await this.pool.query('CALL get_lecturer_exercise_info(?)', [exerciseId]);
            console.log('getExerciseInfoForLecturer - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0][0]; //id, name, descriptions, start_time, end_time, submission_count
        } catch (error) {
            throw error;
        }
    }

    async getAttachFileOfExercise(exerciseId) {
        try {
            const queryResult = await this.pool.query('CALL get_exercise_attach_files(?)', [exerciseId]);
            console.log('getAttachFileOfExercise - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //id, name, descriptions, start_time, end_time, submission_count
        } catch (error) {
            throw error;
        }
    }

    async getAllSubmittedExerciseFiles(exerciseId) {
        try {
            const queryResult = await this.pool.query('CALL get_all_submitted_exercise_files(?)', [exerciseId]);
            console.log('getAllSubmittedExerciseFiles - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //id, file-name
        } catch (error) {
            throw error;
        }
    }

    async deleteExercise(exerciseId) {
        try {
            const queryResult = await this.pool.execute('CALL delete_exercise(?)', [exerciseId]);
            const [resultSetHeader] = queryResult;
            console.log('lecturerDeleteExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            if(resultSetHeader.affectedRows == 1)
                return true;
            return false;
        } catch (error) {
            throw error;
        }
    }

    async getExerciseInfoForStudent(exerciseId, studentId) {
        try {
            const queryResult = await this.pool.query('CALL get_exercise_info_for_student(?, ?)', [...arguments]);
            console.log('getExerciseInfoForStudent - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0][0]; //id, name, descriptions, start_time, end_time, submission_status
        } catch (error) {
            throw error;
        }
    }

    async getOrCreateAndGetSubmittedExerciseId(exerciseId, studentId) {
        try {
            const queryResult = await this.pool.query('CALL get_or_create_n_get_submitted_exercise_id(?, ?)', [...arguments]);
            console.log('getOrCreateAndGetSubmittedExerciseId - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0][0]; //id
        } catch (error) {
            throw error;
        }
    }

    async attachFileToSubmittedExercise(submitExerciseId, fileName) {
        try {
            const queryResult = await this.pool.execute('CALL attach_file_to_submitted_exercise(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('attachFileToExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            
            return queryResult[0][0][0];
        } catch (error) {
            throw error;
        }   
    }

    async getSubmittedExerciseFiles(exerciseId, studentId) {
        try {
            const queryResult = await this.pool.query('CALL get_submitted_exercise_files(?, ?)', [...arguments]);
            console.log('getSubmittedExerciseFiles - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //id, file_name
        } catch (error) {
            throw error;
        }
    }

    async deleteAttachFileOfSubmittedExercise(submittedExerciseAttachFileId, studentId, exerciseId) {
        try {
            const queryResult = await this.pool.execute('CALL delete_submitted_exercise_attach_file(?, ?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('attachFileToExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }   
    }

    async unsubmitExercise(exerciseId, studentId) {
        try {
            const queryResult = await this.pool.execute('CALL unsubmit_exercise(?, ?)', [...arguments]);
            const [resultSetHeader] = queryResult;
            console.log('unsubmitExercise - ResultSetHeader:', resultSetHeader, '-----------------------------\n');
            return true;
        } catch (error) {
            throw error;
        }   
    }

    async getStudentsSubmissionStatus(classId, exerciseId) {
        try {
            const queryResult = await this.pool.query('CALL get_students_submission_status(?, ?)', [...arguments]);
            console.log('getStudentsSubmissionStatus - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //student_id, login_id, student_name, submission_status
        } catch (error) {
            throw error;
        }
    }

    async getStudentsSubmissionStatusWithFiles(classId, exerciseId) {
        try {
            const queryResult = await this.pool.query('CALL get_students_submission_status_with_files(?, ?)', [...arguments]);
            console.log('getStudentsSubmissionStatusWithFiles - QueryResult:', queryResult, '-----------------------------\n');

            return queryResult[0][0]; //student_id, login_id, student_name, submission_status, submitted_files
        } catch (error) {
            throw error;
        }
    }

    async close() {
        try {
            await this.pool.end();
            console.log('Database connection pool closed');
        } catch (error) {
            throw new Error(`Error closing pool: ${error.message}`);
        }
    }
}

(async (testing = false) => {
    if(!testing) return;
    
    const database = new Database();

    const listOfClasses = await database.getAllClass('1', 1);
    console.log(listOfClasses);

    const user = await database.loginUser({ loginId: 'dungmt.22ns@vku.udn.vn', enteredPassword: 'mtdung2004' });
    console.log(user);

    const successCreateClass = await database.createClass(1, 'Lập trình di động (10)');
    console.log(successCreateClass);

    const classList = await database.getAllClass(1);
    console.log(classList);

    database.close();
})()

module.exports = Database