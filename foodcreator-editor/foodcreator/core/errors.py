"""Erros com mensagens pensadas para quem usa o aplicativo, não para programadores."""


class FoodCreatorError(Exception):
    """Erro base. `message` explica o problema; `hint` diz o que fazer."""

    def __init__(self, message: str, hint: str = ""):
        super().__init__(message)
        self.message = message
        self.hint = hint

    def user_text(self) -> str:
        if self.hint:
            return f"{self.message}\nComo resolver: {self.hint}"
        return self.message


class DependencyError(FoodCreatorError):
    """Programa ou biblioteca necessária não encontrada."""


class InvalidInputError(FoodCreatorError):
    """Arquivo de entrada inexistente, ilegível ou sem vídeo."""


class ProcessingError(FoodCreatorError):
    """Falha durante análise, transcrição ou exportação."""


class OutputExistsError(FoodCreatorError):
    """O arquivo de saída já existe e não foi autorizado sobrescrever."""


class CancelledError(FoodCreatorError):
    """O usuário cancelou a operação."""

    def __init__(self, message: str = "Operação cancelada pelo usuário."):
        super().__init__(message)


class ModelDownloadRequired(FoodCreatorError):
    """O modelo de transcrição precisa ser baixado e o usuário ainda não autorizou."""

    def __init__(self, model: str, size_text: str):
        super().__init__(
            f"O modelo de transcrição '{model}' ainda não foi baixado ({size_text}).",
            "Autorize o download quando o aplicativo perguntar.",
        )
        self.model = model
        self.size_text = size_text
