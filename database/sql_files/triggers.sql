DELIMITER $

CREATE TRIGGER generate_invite_codes
BEFORE INSERT ON classes
FOR EACH ROW
BEGIN
    SET NEW.invite_code_students = UUID();
    SET NEW.invite_code_collaborators = UUID();
END $

CREATE TRIGGER generate_meeting_invite_code
BEFORE INSERT ON meetings
FOR EACH ROW
BEGIN
    SET NEW.meeting_code = UUID();
END $

DELIMITER ;