from fastapi import status


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(DomainError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status.HTTP_404_NOT_FOUND)


class ConflictError(DomainError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(message, status.HTTP_409_CONFLICT)


class ValidationMessageError(DomainError):
    def __init__(self, message: str, status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY):
        super().__init__(message, status_code)
