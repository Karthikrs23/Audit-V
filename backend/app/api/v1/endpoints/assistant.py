from __future__ import annotations

from typing import Union
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])
assistant_service = AssistantService()


@router.post(
    "/chat",
    response_model=Union[AssistantChatResponse, None],
    status_code=status.HTTP_200_OK,
    summary="AI Assistant Tax & Financial Chat",
    description=(
        "Processes user questions through intent detection, RAG vector retrieval, "
        "deterministic tax engine calculations, and grounded LLM explanations. "
        "Supports real-time token streaming via Server-Sent Events (SSE) when stream=true (default)."
    ),
)
def chat_with_assistant(request: AssistantChatRequest) -> Union[AssistantChatResponse, StreamingResponse]:
    """Process chat query and return grounded AI assistant response or SSE token stream."""
    try:
        if request.stream:
            return StreamingResponse(
                assistant_service.process_chat_stream_events(request),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        return assistant_service.process_chat(request)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your request. Please try again.",
        ) from err
