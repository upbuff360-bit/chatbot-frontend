export function resolveAgentRoute(pathname: string, agentId: string) {
  if (pathname.includes("/knowledge/text-snippets")) {
    return `/agents/${agentId}/knowledge/text-snippets`;
  }
  if (pathname.includes("/knowledge/qa")) {
    return `/agents/${agentId}/knowledge/qa`;
  }
  if (pathname.includes("/knowledge/websites")) {
    return `/agents/${agentId}/knowledge/websites`;
  }
  if (pathname.includes("/knowledge")) {
    return `/agents/${agentId}/knowledge/pdfs`;
  }
  if (pathname.includes("/chat")) {
    return `/agents/${agentId}/chat`;
  }
  if (pathname.includes("/conversations")) {
    return `/agents/${agentId}/conversations`;
  }
  if (pathname.includes("/leads")) {
    return `/agents/${agentId}/leads`;
  }
  if (pathname.includes("/analytics")) {
    return `/agents/${agentId}/analytics`;
  }
  if (pathname.includes("/settings")) {
    return `/agents/${agentId}/settings`;
  }
  return `/agents/${agentId}/knowledge/pdfs`;
}

export function labelForActivity(activityType: string) {
  switch (activityType) {
    case "agent_created":
      return "Agent";
    case "document_uploaded":
      return "Knowledge";
    case "conversation_updated":
      return "Conversation";
    case "settings_updated":
      return "Settings";
    default:
      return "Activity";
  }
}
