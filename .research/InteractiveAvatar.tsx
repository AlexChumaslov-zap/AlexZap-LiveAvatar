import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
  Tooltip,
} from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import clsx from "clsx";

import AlexAvatarSection from "./StartScreenWithExplanation";
import SuggestionChips from "./SuggestionChips";
import YouTubeVideoModal from "./YouTubeVideoModal";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import Spinner from "./Spinner";
import {
  BrainIcon,
  DownloadIcon,
  EarIcon,
  EmailIcon,
  ShareIcon,
  TalkIcon,
} from "./Icons";

import { createVideoSearcher } from "@/app/lib/video-search/search";

// Define message types
type MessageType = "user" | "avatar";
type ChatMessage = {
  id: string;
  type: MessageType;
  text: string;
  timestamp: number;
  status: "complete" | "partial";
};

type VisitorInfo = {
  name: string;
  company: string | null;
  email: string | null;
};

type EmailFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSend: (email: string) => Promise<boolean>;
};

type ChatHistory = {
  header: string;
  formattedChat: string;
};

// Custom hook to replace usePrevious
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export default function InteractiveAvatar() {
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );
  const [isMobile, setIsMobile] = useState(false);
  // Avatar related states
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<boolean>(false);
  const [debug, setDebug] = useState<string | undefined>();
  const [language, setLanguage] = useState<string>("en");

  // Chat mode states
  const [chatMode, setChatMode] = useState("voice_mode");
  const [text, setText] = useState<string>("");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isAvatarThinking, setIsAvatarThinking] = useState(false);

  // Dialog state
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Session timeout state
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false);

  // Split test state
  const [splitTest, setSplitTest] = useState<boolean>(false);

  // Avatar section state
  const [showAvatarSection, setShowAvatarSection] = useState<boolean>(false);

  // Visitor info
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo>({
    name: "Website Visitor",
    company: null,
    email: null,
  });

  // Session limit states
  const [isSessionLimitReached, setIsSessionLimitReached] = useState(false);
  const [timeUntilNextSession, setTimeUntilNextSession] = useState(0);

  // Environment variables
  const knowledgeId =
    process.env.NEXT_PUBLIC_LA_TEST_CONTEXT_ID ??
    process.env.NEXT_PUBLIC_CUSTOM_KNOWLEDGE_ID;
  const avatarId =
    process.env.NEXT_PUBLIC_LA_TEST_AVATAR_ID ??
    process.env.NEXT_PUBLIC_CUSTOM_AVATAR_ID;
  const voiceId =
    process.env.NEXT_PUBLIC_LA_TEST_VOICE_ID ??
    process.env.NEXT_PUBLIC_CUSTOM_VOICE_ID;

  // Refs
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<LiveAvatarSession | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatStatusRef = useRef<HTMLDivElement>(null);
  const brainSvgRef = useRef<SVGSVGElement | null>(null);
  const earSvgRef = useRef<SVGSVGElement | null>(null);
  const talkSvgRef = useRef<SVGSVGElement | null>(null);
  const speakingTimeout = useRef<NodeJS.Timeout | null>(null);
  const visitorIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const currentMessageRef = useRef<ChatMessage | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SESSION_TIMEOUT = 60 * 1000 * 4; // 4 minutes in milliseconds
  const WARNING_BEFORE_TIMEOUT = 60 * 1000; // Show warning 1 minute before timeout
  const introVideoRef = useRef<HTMLVideoElement>(null);

  // CTA texts for rotating button text
  const ctaTexts = [
    "Got a QA pain point? Talk to me!",
    "Wondering how to boost ROI? Ask me!",
    "Cut testing time by 80% — ask how",
    "How can ZAPTEST help you do more with less?",
    "Need a quick ZAPTEST demo?",
    "Can ZAPTEST prove ROI in 6 months or less?",
    "Steps to create test scripts — ask me!",
    "How fast can you see value with ZAPTEST?",
    "How to automate mobile and desktop apps?",
    "Turn QA into an automation hub — learn more!",
    "Can ZAPTEST help my CI/CD pipeline?",
    "Can ZAPTEST reduce vendor reliance?",
    "Ask Alex Avatar about anything ZAPTEST",
    "Compare ZAPTEST vs. your tool",
    "Show me real‑world use cases",
    "How do I start a free POC?",
    "What integrations do you support?",
    "Help me scale my QA pipeline",
  ];

  // State for the current CTA text index
  const [currentCtaIndex, setCurrentCtaIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const {
    component: YouTubeModalComponent,
    checkForYouTubeLinks,
    showModal: showYouTubeModal,
  } = YouTubeVideoModal({ splitTest });

  /**
   * Fetches access token for avatar API
   */
  async function fetchAccessToken(): Promise<string> {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          avatar_id: avatarId,
          context_id: knowledgeId,
          voice_id: voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error("Error fetching access token:", error);

      return "";
    }
  }

  /**
   * Saves chat message to database
   */
  const saveChatMessage = async (
    text: string,
    sender: MessageType,
  ): Promise<boolean> => {
    try {
      // Don't attempt to save if there's no text
      if (!text.trim()) {
        return false;
      }
      if (sender == "user") {
        const videoSearcher = createVideoSearcher();
        const results = videoSearcher.processUserMessage(text);

        if (results.success && results.url) {
          checkForYouTubeLinks(results.url);
        }
      }

      console.log("sender", sender);
      const response = await fetch("/api/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          visitorId: visitorIdRef.current,
          conversationId: conversationIdRef.current,
          message: text,
          sender: sender,
          visitorInfo: !visitorIdRef.current ? visitorInfo : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update IDs if they were just created
        if (!visitorIdRef.current && data.visitorId) {
          visitorIdRef.current = data.visitorId;
        }

        if (!conversationIdRef.current && data.conversationId) {
          conversationIdRef.current = data.conversationId;
        }

        return true;
      } else {
        console.error("Database operation failed:", data.error);

        return false;
      }
    } catch (error) {
      console.error("Error saving chat message:", error);

      return false;
    }
  };

  /**
   * Adds a message to chat history
   */
  const addMessageToHistory = useCallback(
    (message: Partial<ChatMessage>): ChatMessage => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: message.type || "avatar",
        text: message.text || "",
        timestamp: Date.now(),
        status: message.status || "complete",
      };

      setChatHistory((prevHistory) => [...prevHistory, newMessage]);

      // Save complete messages to the database
      if (
        (message.status === "complete" || message.status === undefined) &&
        newMessage.text.trim() &&
        newMessage.type === "user"
      ) {
        saveChatMessage(newMessage.text, newMessage.type).catch((error) =>
          console.error("Error saving message:", error),
        );
      }

      return newMessage;
    },
    [visitorInfo],
  );

  /**
   * Resets session timeout timers
   */
  const resetSessionTimeout = useCallback(() => {
    console.log("resetSessionTimeout run");
    // Clear existing timers
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }

    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
      setSessionTimeoutWarning(false);
    }
    setSessionTimeoutWarning(true);

    // Only set timers if session is active
    if (mediaStream.current) {
      console.log("Setting session timeout timers");
      // Set warning timer
      warningTimeoutRef.current = setTimeout(() => {
        setSessionTimeoutWarning(true);
      }, SESSION_TIMEOUT - WARNING_BEFORE_TIMEOUT);

      // Set session end timer
      sessionTimeoutRef.current = setTimeout(() => {
        console.log("Session timeout - ending due to inactivity");
        endSession();
      }, SESSION_TIMEOUT);
    }
  }, [endSession]);

  /**
   * Clears session timeout timers
   */
  const clearSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }

    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
      setSessionTimeoutWarning(false);
    }
  }, []);

  /**
   * Cleans chat history and resets related state
   */
  const cleanChatHistory = useCallback(() => {
    // Clear chat history from state
    setChatHistory([]);

    // Reset current message reference
    currentMessageRef.current = null;
    // Clean chat input
    setText("");

    console.log("Chat history cleared");
  }, []);

  /**
   * Check is iOS device
   */
  const isIOS = () => {
    if (typeof navigator === "undefined") return false;

    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    );
  };

  /**
   * Starts a new avatar session
   */
  async function startSession(initialQuestion?: string) {
    console.log("startSession run");

    // --- FIX FOR IOS MICROPHONE START ---
    // Запитуємо доступ відразу, щоб iOS не заблокував його через затримку (async/await)
    if (isIOS() || isMobile) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        // Одразу закриваємо потік, нам потрібен лише факт надання дозволу
        tempStream.getTracks().forEach((track) => track.stop());
        console.log("iOS Microphone permission pre-granted");
      } catch (e) {
        console.error("Error pre-requesting mic permission:", e);
        // Не зупиняємо виконання, можливо SDK впорається саме
      }
    }
    // --- FIX END ---

    if (avatar.current) {
      return;
    }

    // Check if user can start a new session
    if (!canStartNewSession()) {
      const timeRemaining = getTimeUntilNextSession();

      setTimeUntilNextSession(timeRemaining);
      setIsSessionLimitReached(true);

      return;
    }

    setIsLoadingSession(true);
    if (!isIOS()) {
      try {
        if (!introVideoRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (introVideoRef.current) {
          // introVideoRef.current.muted = true;
          await introVideoRef.current.play();
          console.log("Video playing");
        }
      } catch (error) {
        console.error("Video play error:", error);
      }
    }

    // Виклик LinkedIn Conversion API
    if (
      typeof window !== "undefined" &&
      typeof (window as any).lintrk === "function"
    ) {
      (window as any).lintrk("track", { conversion_id: 21704625 });
      console.log("LinkedIn conversion tracked");
    } else {
      console.log("LinkedIn conversion not tracked");
    }

    try {
      const newToken = await fetchAccessToken();

      if (!newToken) {
        setDebug("Failed to get access token");
        setIsLoadingSession(false);

        return;
      }

      avatar.current = new LiveAvatarSession(newToken, {
        voiceChat: true,
      });

      setupAvatarEventListeners(initialQuestion);

      // Create and start the avatar
      if (avatar.current) {
        await avatar.current.start();

        setIsLoadingSession(false);

        //pause and remove introVideoRef
        if (introVideoRef.current) {
            introVideoRef.current.pause();
            introVideoRef.current.src = "";
            introVideoRef.current = null;
        }

        // Start microphone voice chat (replaces startVoiceChat in old SDK)
        try {
          await avatar.current.voiceChat.start();
        } catch (e) {
          console.error("Voice chat start failed:", e);
        }

        setChatMode("voice_mode");
      }
      resetSessionTimeout();
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setDebug(
        `Error starting session: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoadingSession(false);
    }
  }

  /**
   * Sets up event listeners for the avatar instance
   */
  function setupAvatarEventListeners(initialQuestion?: string) {
    if (!avatar.current) return;

    avatar.current.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      console.log("Avatar started talking");
      setIsAvatarSpeaking(true);
      setIsAvatarThinking(false);
      randomPhrasesTimeoutFlush();
    });

    avatar.current.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      console.log("Avatar stopped talking");
      setIsAvatarSpeaking(false);
      randomPhrasesTimeout();
    });

    avatar.current.on(SessionEvent.SESSION_DISCONNECTED, () => {
      console.log("Session disconnected");
      endSession();
    });

    avatar.current.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      console.log("Session state:", state);
      if (state === SessionState.DISCONNECTED) {
        endSession();
      }
    });

    avatar.current.on(SessionEvent.SESSION_STREAM_READY, () => {
      console.log("Stream ready");
      // Just flip state — useEffect below attaches after the <video> mounts
      setStream(true);
      handleIntro(initialQuestion);
    });

    avatar.current.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      console.log("User started talking");
      setIsUserTalking(true);
      randomPhrasesTimeoutFlush();
      resetSessionTimeout();
    });

    avatar.current.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
      console.log("User stopped talking");
    });

    // Final avatar transcription — save completed message to DB
    avatar.current.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      const fullText = event?.text;

      if (!fullText) return;
      console.log("Avatar transcription (final):", fullText);

      const completedMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "avatar",
        text: fullText,
        timestamp: Date.now(),
        status: "complete",
      };

      if (fullText.trim()) {
        saveChatMessage(fullText, "avatar").catch((error) =>
          console.error("Error saving avatar message:", error),
        );
      }

      setChatHistory((prevHistory) => {
        const updatedHistory = [...prevHistory];
        const partialIndex = updatedHistory.findLastIndex(
          (msg) => msg.type === "avatar" && msg.status === "partial",
        );

        if (partialIndex !== -1) {
          updatedHistory[partialIndex] = completedMessage;

          return updatedHistory;
        }

        return [...updatedHistory, completedMessage];
      });

      currentMessageRef.current = null;
    });

    // Streaming avatar chunks — appended to a partial message
    avatar.current.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (event) => {
      const messagePart = event?.text;

      if (!messagePart) return;

      if (!currentMessageRef.current) {
        const newMessage = addMessageToHistory({
          type: "avatar",
          text: messagePart,
          status: "partial",
        });

        currentMessageRef.current = newMessage;
      } else {
        setChatHistory((prevHistory) => {
          const updatedHistory = [...prevHistory];
          const partialIndex = updatedHistory.findLastIndex(
            (msg) => msg.type === "avatar" && msg.status === "partial",
          );

          if (partialIndex !== -1) {
            updatedHistory[partialIndex] = {
              ...updatedHistory[partialIndex],
              text: updatedHistory[partialIndex].text + messagePart,
            };
          }

          return updatedHistory;
        });

        if (currentMessageRef.current) {
          currentMessageRef.current.text += messagePart;
        }
      }
    });

    avatar.current.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
      const messageText = event?.text;

      if (!messageText) {
        console.log("Empty user message");

        return;
      }

      console.log("User transcription:", messageText);

      addMessageToHistory({
        type: "user",
        text: messageText,
        status: "complete",
      });

      setIsUserTalking(false);
      setIsAvatarThinking(true);
    });
  }

  /**
   * Handles speaking for the avatar
   */
  async function handleSpeak(phrase = "") {
    setIsLoadingRepeat(true);
    setIsAvatarThinking(true);

    try {
      if (!avatar.current) {
        setDebug("Avatar API not initialized");

        return;
      }

      const tts = phrase || text;

      avatar.current.message(tts);
    } catch (e) {
      setDebug(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingRepeat(false);
    }
  }

  /**
   * Handles repeat for the avatar
   */
  async function handleRepeat(phrase: string) {
    setIsLoadingRepeat(true);

    try {
      if (!avatar.current) {
        setDebug("Avatar API not initialized");

        return;
      }

      avatar.current.repeat(phrase);
    } catch (e) {
      setDebug(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingRepeat(false);
    }
  }

  /**
   * Handles interrupt for the avatar
   */
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }

    try {
      await avatar.current.interrupt();
    } catch (e) {
      setDebug(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Ends the avatar session
   */
  async function endSession() {
    try {
      await avatar.current?.stop();
      avatar.current = null;
      setStream(false);
      clearSessionTimeout();
      cleanChatHistory();
    } catch (error) {
      console.error("Error ending session:", error);
    }
  }

  /**
   * Handles intro for the avatar
   */
  async function handleIntro(initialQuestion?: string) {
    console.log("handleIntro run");
    console.log("initialQuestion", initialQuestion);

    if (initialQuestion) {
      await handleSpeak(initialQuestion);

      return;
    }

    if (!avatar.current) {
      console.error("Avatar is not available");

      return;
    }

    // try {
    //   await avatar.current.speak({
    //     text: "Hey! I'm Alex ZAP, your go-to for all things ZAPTEST. Need the scoop on testing tools or wanna book a demo? I got you! Let's zap through your questions—what's up?",
    //     taskType: TaskType.REPEAT,
    //     taskMode: TaskMode.SYNC,
    //   });
    // } catch (error) {
    //   console.error("Error in handleIntro:", error);
    //   setIsAvatarSpeaking(false);
    // }
  }

  /**
   * Sets a timeout for random phrases
   */
  const randomPhrasesTimeout = () => {
    randomPhrasesTimeoutFlush();

    speakingTimeout.current = setTimeout(() => {
      speakRandomPhrase();
    }, 30000);
  };

  /**
   * Clears the random phrases timeout
   */
  const randomPhrasesTimeoutFlush = () => {
    if (speakingTimeout.current) {
      clearTimeout(speakingTimeout.current);
      speakingTimeout.current = null;
    }
  };

  /**
   * Speaks a random phrase
   */
  const speakRandomPhrase = async () => {
    const randomPhrases = [
      "Want to know more about ZAPTEST?",
      "I can help you automate anything!",
      "Ask me about ZAPTEST features!",
      "Need testing insights? I'm here!",
      "Let's talk automation!",
      "Ready to optimize your testing?",
      "Wondering how ZAPTEST works?",
      "I've got ZAPTEST tips for you!",
      "Let's boost your efficiency!",
      "Want to see ZAPTEST in action?",
      "Software testing made easy—ask me how!",
      "Got a testing challenge? I can help!",
      "Let's talk about test automation!",
      "ZAPTEST can save you time—curious?",
      "Maximize your automation—just ask!",
      "Need help with scripting? I'm ready!",
      "Want to speed up your testing process?",
      "I'm here to guide you through ZAPTEST!",
      "Let's explore test automation together!",
      "Ask me how ZAPTEST can improve your workflow!",
      "Looking for a no-code automation solution?",
      "Want to automate testing effortlessly?",
      "ZAPTEST can save you time—let me show you how!",
      "Curious about cross-platform testing?",
      "I can help you automate like a pro!",
      "Let's make testing faster and easier!",
      "ZAPTEST supports any technology—ask me how!",
      "Need help with test automation strategies?",
      "Want to eliminate manual testing pain points?",
      "Ask me how to scale your automation!",
    ];

    const phrase =
      randomPhrases[Math.floor(Math.random() * randomPhrases.length)];

    await handleRepeat(phrase);
  };

  /**
   * Scrolls to the bottom of the chat
   */
  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  /**
   * Gets the chat history
   */
  const getChatHistory = useCallback((): ChatHistory | null => {
    if (chatHistory.length === 0) {
      console.log("No messages to export");

      return null;
    }

    const formattedChat = chatHistory
      .map((message) => {
        const sender = message.type === "user" ? "User" : "Alex ZAP";
        const timestamp = new Date(message.timestamp).toLocaleString();

        return `[${timestamp}] ${sender}:\n${message.text}\n`;
      })
      .join("\n");

    const header =
      "=== Conversation history with Alex ZAP ===\n" +
      `Exported: ${new Date().toLocaleString()}\n\n`;

    return { header, formattedChat };
  }, [chatHistory]);

  /**
   * Exports chat history to a text file
   */
  const exportChatHistory = useCallback(() => {
    const chat = getChatHistory();

    if (!chat) return;

    const { header, formattedChat } = chat;
    const fileContent = header + formattedChat;
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = url;
    downloadLink.download = `chat-export-${new Date().toISOString().slice(0, 10)}.txt`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [getChatHistory]);

  /**
   * Shares chat history using Web Share API
   */
  const shareChatHistory = useCallback(() => {
    const chat = getChatHistory();

    if (!chat) return;

    const { header, formattedChat } = chat;
    const fullText = header + formattedChat;

    // Function to copy text to clipboard
    const copyToClipboard = () => {
      navigator.clipboard
        .writeText(fullText)
        .then(() => {
          console.log("Chat history copied to clipboard");
          alert(
            "Web Share not available. Chat history copied to clipboard instead.",
          );
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          alert(
            "Could not share or copy chat history. See console for details.",
          );
        });
    };

    // Check if Web Share API is supported
    if (!navigator.share) {
      console.log("Web Share API not supported");
      copyToClipboard();

      return;
    }

    // Create a text file blob
    const blob = new Blob([fullText], { type: "text/plain" });
    const file = new File([blob], "alex-zap-conversation.txt", {
      type: "text/plain",
    });

    // Use Web Share API to share the file
    navigator
      .share({
        title: "Conversation with Alex ZAP",
        text: "Here is my conversation with Alex ZAP",
        files: [file],
      })
      .then(() => console.log("Chat history shared successfully"))
      .catch((error) => {
        console.error("Error sharing chat history:", error);
        // Fallback to clipboard if sharing fails
        copyToClipboard();
      });
  }, [getChatHistory]);

  /**
   * Sends chat history via email
   */
  const sendChatHistoryEmail = async (
    emailAddress: string,
  ): Promise<boolean> => {
    // Validate the email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailAddress || !emailRegex.test(emailAddress)) {
      console.error("Invalid email address");

      return false;
    }

    try {
      // Format chat history for email
      const chat = getChatHistory();

      if (!chat) {
        console.error("No chat history to send");

        return false;
      }

      const { formattedChat } = chat;

      // Create email content
      const emailContent = {
        to: emailAddress,
        subject: "Your Conversation with Alex ZAP",
        chatHistory: formattedChat,
        date: new Date().toLocaleString(),
      };

      // Send to API endpoint
      const response = await fetch("/api/send-chat-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailContent),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      return result.success === true;
    } catch (error) {
      console.error("Error sending email:", error);

      return false;
    }
  };

  /**
   * Handles chat mode change
   */
  const handleChangeChatMode = useCallback(
    async (v: string) => {
      console.log("handleChangeChatMode", v);
      if (v === chatMode) {
        return;
      }

      try {
        // Maximum number of retries
        const maxRetries = 3;
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
          try {
            if (v === "text_mode") {
              avatar.current?.voiceChat.stop();
            } else {
              await avatar.current?.voiceChat.start();
            }
            success = true;
          } catch (retryError) {
            retryCount++;
            console.log(`Retry attempt ${retryCount}/${maxRetries}`);

            // If this is a WebSocket connection error, wait before retrying
            if (
              retryError instanceof Error &&
              retryError.message.includes("CONNECTING state")
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              // If it's not a connection state error, just re-throw
              throw retryError;
            }
          }
        }
        setChatMode(v);
      } catch (error) {
        console.error("Error changing chat mode:", error);
        setDebug(
          `Error changing chat mode: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [chatMode],
  );

  /**
   * Initializes conversation from database
   */
  const initializeConversation = async () => {
    if (!visitorIdRef.current) return;

    try {
      const response = await fetch(
        `/api/history?visitorId=${visitorIdRef.current}`,
        { method: "GET" },
      );

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.conversation) {
        conversationIdRef.current = data.conversation.id;

        // If there are previous messages, load them
        if (data.messages && data.messages.length > 0) {
          const formattedMessages = data.messages.map((msg: any) => ({
            id: `db-msg-${msg.id}`,
            type: msg.sender as MessageType,
            text: msg.message,
            timestamp: new Date(msg.timestamp).getTime(),
            status: "complete",
          }));

          setChatHistory(formattedMessages);
        }
      }
    } catch (error) {
      console.error("Error initializing conversation:", error);
    }
  };

  /**
   * Checks if user can start a new session based on usage limit
   * @returns {boolean} true if user can start a new session, false otherwise
   */
  const canStartNewSession = (): boolean => {
    const MAX_SESSIONS = 3; // Maximum number of sessions per hour
    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds

    try {
      // Get stored sessions from localStorage
      const sessionsData = localStorage.getItem("zapSessionData");

      if (!sessionsData) {
        // First session, initialize and allow
        const newData = {
          sessions: [Date.now()],
          firstSessionTime: Date.now(),
        };

        localStorage.setItem("zapSessionData", JSON.stringify(newData));

        return true;
      }

      const data = JSON.parse(sessionsData);
      const currentTime = Date.now();

      // Check if first session was more than an hour ago - reset if so
      if (currentTime - data.firstSessionTime > ONE_HOUR_MS) {
        const newData = {
          sessions: [currentTime],
          firstSessionTime: currentTime,
        };

        localStorage.setItem("zapSessionData", JSON.stringify(newData));

        return true;
      }

      // Filter out sessions older than 1 hour
      const recentSessions = data.sessions.filter(
        (time: number) => currentTime - time < ONE_HOUR_MS,
      );

      // Check if user can start a new session
      if (recentSessions.length < MAX_SESSIONS) {
        // Add new session time and save
        recentSessions.push(currentTime);
        const newData = {
          sessions: recentSessions,
          firstSessionTime: data.firstSessionTime,
        };

        localStorage.setItem("zapSessionData", JSON.stringify(newData));

        return true;
      }

      // Update localStorage with filtered sessions
      localStorage.setItem(
        "zapSessionData",
        JSON.stringify({
          sessions: recentSessions,
          firstSessionTime: data.firstSessionTime,
        }),
      );

      // User has reached the session limit
      return false;
    } catch (error) {
      console.error("Error checking session limits:", error);

      // In case of error, allow session to prevent locking users out
      return true;
    }
  };

  /**
   * Gets time remaining until next available session
   * @returns {number} Time in minutes until next session is available
   */
  const getTimeUntilNextSession = (): number => {
    try {
      const sessionsData = localStorage.getItem("zapSessionData");

      if (!sessionsData) {
        return 0;
      }

      const data = JSON.parse(sessionsData);
      const currentTime = Date.now();

      // Sort sessions by time (oldest first)
      const sortedSessions = [...data.sessions].sort(
        (a: number, b: number) => a - b,
      );

      // Calculate when the oldest session will expire
      if (sortedSessions.length > 0) {
        const oldestSessionTime = sortedSessions[0];
        const expiryTime = oldestSessionTime + 60 * 60 * 1000; // 1 hour after oldest session
        const timeRemaining = expiryTime - currentTime;

        // Convert to minutes and round up
        return Math.ceil(timeRemaining / (60 * 1000));
      }

      return 0;
    } catch (error) {
      console.error("Error calculating time until next session:", error);

      return 0;
    }
  };

  /**
   * SessionLimitModal component
   */
  type SessionLimitModalProps = {
    isOpen: boolean;
    onClose: () => void;
    timeRemaining: number;
  };

  const SessionLimitModal = ({
    isOpen,
    onClose,
    timeRemaining,
  }: SessionLimitModalProps) => {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 text-center">
            <span className="text-red-600 font-bold">
              Chat Sessions Limit Reached
            </span>
          </ModalHeader>
          <ModalBody>
            <div className="text-center p-4">
              <p className="mb-4">
                You have reached the maximum number of chat sessions allowed (3
                per hour).
              </p>
              <p className="font-semibold">
                Please try again in {timeRemaining}{" "}
                {timeRemaining === 1 ? "minute" : "minutes"}.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="bg-gradient-to-tr from-red-600 to-red-950 text-white"
              onPress={onClose}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

  type EmailFormDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSend: (email: string) => Promise<boolean>;
  };

  // Email dialog component
  const EmailFormDialog = ({
    isOpen,
    onOpenChange,
    onSend,
  }: EmailFormDialogProps) => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"success" | "error" | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // useEffect(() => {
    //   if (isOpen) {
    //     setEmail("");
    //     setStatus(null);
    //     setIsLoading(false);
    //     if (timeoutRef.current) {
    //       clearTimeout(timeoutRef.current);
    //       timeoutRef.current = null;
    //     }
    //   }
    // }, [isOpen]);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    const handleSend = useCallback(async () => {
      if (!email.trim()) {
        setStatus("error");

        return;
      }
      setIsLoading(true);
      setStatus(null);

      try {
        const ok = await onSend(email);

        setIsLoading(false);
        setStatus(ok ? "success" : "error");

        if (ok) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            onOpenChange(false);
            timeoutRef.current = null;
          }, 1200);
        }
      } catch {
        setIsLoading(false);
        setStatus("error");
      }
    }, [email, onSend, onOpenChange]);

    const handleModalChange = useCallback(
      (open: boolean) => {
        if (isLoading && !open) return;
        onOpenChange(open);
      },
      [isLoading, onOpenChange],
    );

    return (
      <Modal
        hideCloseButton={false}
        isDismissable={!isLoading}
        isOpen={isOpen}
        placement="center"
        onOpenChange={handleModalChange}
      >
        <ModalContent>
          <ModalHeader>Send Chat History via Email</ModalHeader>
          <ModalBody>
            <Input
              isDisabled={isLoading}
              label="Email Address"
              placeholder="your@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && email.trim()) {
                  handleSend();
                }
              }}
            />
            {status === "success" && (
              <div className="text-green-500 text-sm">
                ✓ Email sent! Closing…
              </div>
            )}
            {status === "error" && (
              <div className="text-red-500 text-sm">
                ✗ Failed to send. Check the address and try again.
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              isDisabled={isLoading}
              variant="light"
              onPress={() => handleModalChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-tr from-red-600 to-red-950 text-white"
              isDisabled={!email.trim() || isLoading}
              isLoading={isLoading}
              onPress={handleSend}
            >
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

  // Effect to handle listening state
  const previousText = usePrevious(text);

  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar.current?.stopListening();
    }
  }, [text, previousText]);

  // Effect to clean up when component unmounts
  useEffect(() => {
    return () => {
      endSession();
      randomPhrasesTimeoutFlush();
      clearSessionTimeout();
    };
  }, []);

  // Attach the LiveAvatar stream once the <video> element has mounted.
  // stream is flipped to true by the SESSION_STREAM_READY handler; this effect
  // runs on the next render tick when mediaStream.current is populated.
  useEffect(() => {
    if (stream && mediaStream.current && avatar.current) {
      avatar.current.attach(mediaStream.current);
      mediaStream.current.onloadedmetadata = () => {
        setDebug("Playing");
      };
    }
  }, [stream]);

  // Effect to update avatar status indicators
  useEffect(() => {
    if (isAvatarSpeaking) {
      talkSvgRef.current?.classList.add("fill-[#00ff00]");
    } else {
      talkSvgRef.current?.classList.remove("fill-[#00ff00]");
    }

    if (!isAvatarThinking && !isAvatarSpeaking) {
      earSvgRef.current?.classList.add("fill-[#00ff00]");
    } else {
      earSvgRef.current?.classList.remove("fill-[#00ff00]");
    }

    if (isAvatarThinking) {
      brainSvgRef.current?.classList.add("fill-[#00ff00]");
    } else {
      brainSvgRef.current?.classList.remove("fill-[#00ff00]");
    }
  }, [isAvatarSpeaking, isAvatarThinking]);

  // Effect to scroll chat to bottom when history changes
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, scrollToBottom]);

  // Effect to load visitor ID from localStorage
  useEffect(() => {
    const storedVisitorId = localStorage.getItem("visitorId");

    if (storedVisitorId) {
      visitorIdRef.current = storedVisitorId;
      // initializeConversation();
    }
  }, []);

  // Effect to update localStorage when visitor ID changes
  useEffect(() => {
    if (visitorIdRef.current) {
      localStorage.setItem("visitorId", visitorIdRef.current);
    }
  }, [visitorIdRef.current]);

  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Effect to check for mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < window.innerHeight); // Standard tablet breakpoint
    };

    // Check on initial load
    checkMobile();

    // Set up event listener for window resize
    window.addEventListener("resize", checkMobile);

    // Clean up
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Effect to rotate the CTA text every 4 seconds
  useEffect(() => {
    if (stream || isEmailDialogOpen || isSessionLimitReached) {
      return;
    }
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentCtaIndex(
          (prevIndex: number) => (prevIndex + 1) % ctaTexts.length,
        );
        setIsAnimating(false);
      }, 500); // Half a second for fade out, then change text
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [isEmailDialogOpen, isSessionLimitReached, stream]);

  // add messages to local testing
  // useEffect(() => {
  //   if (process.env.NEXT_PUBLIC_PRODUCTION === "false") {
  //     setChatHistory({
  //       // @ts-ignore
  //       type: "avatar",
  //       text: "Hey! I'm Alex ZAP, your go-to for all things ZAPTEST. Need the scoop on testing tools or wanna book a demo? I got you!",
  //       timestamp: Date.now() - 240000, // 4 minutes ago
  //       status: "complete",
  //     });
  //     setChatHistory({
  //       // @ts-ignore
  //       type: "user",
  //       text: "Hi Alex! What's special about ZAPTEST?",
  //       timestamp: Date.now() - 180000, // 3 minutes ago
  //       status: "complete",
  //     });
  //     setChatHistory({
  //       // @ts-ignore
  //       type: "avatar",
  //       text: "Great question! ZAPTEST is an all-in-one automation platform that works across any technology. It's perfect for web, mobile, desktop, and even legacy systems testing.",
  //       timestamp: Date.now() - 120000, // 2 minutes ago
  //       status: "complete",
  //     });
  //     setChatHistory({
  //       // @ts-ignore
  //       type: "user",
  //       text: "That sounds useful. Do I need coding experience to use it?",
  //       timestamp: Date.now() - 60000, // 1 minute ago
  //       status: "complete",
  //     });
  //   }
  // }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);

      setShowAvatarSection(urlParams.get("view") !== null);
      setSplitTest(urlParams.get("split") !== null);
      // if mobile, set splittest to false
      if (window.innerWidth < 768) {
        setSplitTest(false);
      }
    }
  }, []);

  if (splitTest) {
    return (
      <div
        className="h-screen w-screen flex flex-row overflow-hidden"
        suppressHydrationWarning={true}
      >
        {/* Alex Avatar Section - only visible when URL parameter is present */}
        {showAvatarSection && (
          <AlexAvatarSection onStartSession={startSession} />
        )}

        <Card className="w-1/2 rounded-none gap-0 p-0 bg-no-repeat bg-cover bg-center bg-[url('/AZa-bg-hover-gif.webp')]">
          <CardBody className="h-screen w-full rounded-none gap-0 p-0">
            {stream || 0 ? (
              <div className="h-screen w-full justify-center items-center flex overflow-hidden relative">
                <video
                  ref={mediaStream}
                  autoPlay
                  playsInline
                  className="h-full"
                  style={{
                    width: "auto",
                    height: "100%",
                    objectFit: "contain",
                    maxWidth: "10000%",
                  }}
                >
                  <track kind="captions" />
                </video>
                <div
                  className={clsx(
                    "flex absolute top-4 right-4 items-end gap-4",
                    chatMode === "text_mode" && windowHeight < 510
                      ? "flex-row-reverse items-center"
                      : "flex-col right-4",
                  )}
                >
                  <Button
                    className="bg-gradient-to-tr from-red-600 to-red-950 text-white rounded-lg"
                    id="end-session-button"
                    size="md"
                    variant="shadow"
                    onPress={endSession}
                  >
                    End session
                  </Button>
                  <Tooltip content="Download chat history">
                    <DownloadIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="download-chat-history"
                      onClick={exportChatHistory}
                    />
                  </Tooltip>
                  <Tooltip content="Share chat history">
                    <ShareIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="share-chat-history"
                      onClick={shareChatHistory}
                    />
                  </Tooltip>
                  <Tooltip content="Send chat history via email">
                    <EmailIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="send-chat-history-email"
                      onClick={() => {
                        if (chatHistory.length === 0) {
                          // Optional: Show a message that there's no chat to export
                          return;
                        }
                        setIsEmailDialogOpen(true);
                      }}
                    />
                  </Tooltip>
                </div>
                <CardFooter className="flex flex-row gap-3 absolute bottom-0 w-full items-end">
                  <div className="w-full flex flex-col relative">
                    <div
                      ref={chatRef}
                      className="w-full max-h-[200px] overflow-y-auto mx-auto rounded-large bg-gray-500 p-4 text-black bg-opacity-75"
                    >
                      {chatHistory.map((message) => (
                        <div
                          key={message.id}
                          className={`p-2 ${
                            message.type === "user" ? "text-right" : "text-left"
                          }`}
                        >
                          <span
                            className={`
                            inline-block p-2 rounded 
                            ${message.type === "user" ? "bg-gray-200" : "bg-gray-300"}
                            ${message.status === "partial" ? "opacity-50" : ""}
                          `}
                          >
                            <Markdown>{message.text}</Markdown>
                          </span>
                        </div>
                      ))}
                    </div>
                    <InteractiveAvatarTextInput
                      disabled={!stream}
                      input={text}
                      label="Chat"
                      loading={isLoadingRepeat}
                      placeholder="Type something for the avatar to respond"
                      setInput={setText}
                      onSubmit={handleSpeak}
                    />
                    {text && (
                      <Chip className="absolute right-16 top-3">Listening</Chip>
                    )}
                  </div>
                  <div className="text-center">
                    <div
                      ref={chatStatusRef}
                      className="bg-black/50 rounded-[60px] min-w-[20%] flex justify-center gap-2 items-center px-8 py-2"
                    >
                      <Tooltip content="Listening">
                        <EarIcon ref={earSvgRef} />
                      </Tooltip>
                      <Tooltip content="Thinking">
                        <BrainIcon ref={brainSvgRef} />
                      </Tooltip>
                      <Tooltip content="Speaking">
                        <TalkIcon ref={talkSvgRef} />
                      </Tooltip>
                    </div>
                  </div>
                </CardFooter>
              </div>
            ) : !isLoadingSession ? (
              <div className="h-screen w-full justify-end items-center flex flex-col gap-8 self-center">
                {splitTest ? (
                  <>
                    <Button
                      className="bg-gradient-to-tr from-red-600 to-red-950 text-white w-auto pt-3 pb-3 pl-6 pr-6 font-bold mb-3 h-auto pulse transition-all duration-500 max-w-[90%]"
                      id="start-session-button"
                      size="lg"
                      variant="shadow"
                      onPress={() => {
                        startSession();
                      }}
                    >
                      <span
                        className={`transition-opacity duration-500 ${isAnimating ? "opacity-0" : "opacity-100"} text-xl sm:text-3xl whitespace-normal text-center max-w-[300px] sm:max-w-none`}
                      >
                        {ctaTexts[currentCtaIndex]}
                      </span>
                    </Button>
                    {/* Simplified SuggestionChips with internal suggestion data */}
                    <SuggestionChips
                      count={3} // Show 3 random suggestions each time
                      onSelect={(prompt) => startSession(prompt)}
                    />
                  </>
                ) : (
                  <Button
                    className="bg-gradient-to-tr from-red-600 to-red-950 text-white w-auto pt-3 pb-3 pl-6 pr-6 font-bold mb-3 h-auto pulse transition-all duration-500"
                    id="start-session-button"
                    size="lg"
                    variant="shadow"
                    onPress={() => {
                      startSession();
                    }}
                  >
                    Talk
                  </Button>
                )}
              </div>
            ) : null}
          </CardBody>
        </Card>
        <EmailFormDialog
          isOpen={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          onSend={sendChatHistoryEmail}
        />
        <SessionLimitModal
          isOpen={isSessionLimitReached}
          timeRemaining={timeUntilNextSession}
          onClose={() => setIsSessionLimitReached(false)}
        />
        {YouTubeModalComponent}
      </div>
    );
  } else {
    return (
      <div
        className={clsx(
          "h-screen w-screen flex flex-col bg-no-repeat bg-cover bg-center overflow-hidden bg-[url('/AZa-bg.webp')]",
          splitTest && "hover:bg-[url('/AZa-bg-hover-gif.webp')]",
        )}
        // style={{ backgroundImage: "url('/AZa-bg.webp')" }}  hover:bg-[url('/AZa-bg-hover.png')]
        suppressHydrationWarning={true}
      >
        {/* Alex Avatar Section - only visible when URL parameter is present */}
        {showAvatarSection && (
          <AlexAvatarSection onStartSession={startSession} />
        )}

        <Card className="rounded-none gap-0 p-0 bg-none bg-transparent">
          <CardBody className="h-screen w-screen rounded-none gap-0 p-0">
            {stream ? (
              <div className="h-screen w-screen justify-center items-center flex overflow-hidden">
                <video
                  ref={mediaStream}
                  autoPlay
                  playsInline
                  className="h-full"
                  style={{
                    width: "auto",
                    height: "100%",
                    objectFit: "contain",
                    maxWidth: "10000%",
                  }}
                >
                  <track kind="captions" />
                </video>
                <div
                  className={clsx(
                    "flex absolute top-4 right-4 items-end gap-4",
                    chatMode === "text_mode" && windowHeight < 510
                      ? "flex-row-reverse items-center"
                      : "flex-col right-4",
                  )}
                >
                  <Button
                    className="bg-gradient-to-tr from-red-600 to-red-950 text-white rounded-lg"
                    id="end-session-button"
                    size="md"
                    variant="shadow"
                    onPress={endSession}
                  >
                    End session
                  </Button>
                  <Tooltip content="Download chat history">
                    <DownloadIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="download-chat-history"
                      onClick={exportChatHistory}
                    />
                  </Tooltip>
                  <Tooltip content="Share chat history">
                    <ShareIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="share-chat-history"
                      onClick={shareChatHistory}
                    />
                  </Tooltip>
                  <Tooltip content="Send chat history via email">
                    <EmailIcon
                      className="cursor-pointer transition-all hover:scale-125"
                      id="send-chat-history-email"
                      onClick={() => setIsEmailDialogOpen(true)}
                    />
                  </Tooltip>
                </div>
                <CardFooter className="flex flex-col gap-3 absolute bottom-0 w-full">
                  {/*{sessionTimeoutWarning && (*/}
                  {/*  <div className="absolute bottom-4 right-4 bg-red-100 text-red-800 p-3 rounded-lg shadow-lg max-w-sm z-10">*/}
                  {/*    <h4 className="font-bold mb-1">Session Timeout Warning</h4>*/}
                  {/*    <p>*/}
                  {/*      Your session will end soon due to inactivity. Say*/}
                  {/*      something or type a message to continue.*/}
                  {/*    </p>*/}
                  {/*  </div>*/}
                  {/*)}*/}
                  <Tabs
                    aria-label="Options"
                    selectedKey={chatMode}
                    onSelectionChange={(v) => handleChangeChatMode(v as string)}
                  >
                    <Tab
                      key="voice_mode"
                      className="bg-gradient-to-tr from-red-600 to-red-950 text-white"
                      id="voice_mode"
                      title="Voice mode"
                    />
                    <Tab
                      key="text_mode"
                      className="bg-gradient-to-tr from-red-600 to-red-950 text-white"
                      id="text_mode"
                      title="Text mode"
                    />
                  </Tabs>
                  {chatMode === "text_mode" ? (
                    <div className="w-full flex flex-col relative">
                      <div
                        ref={chatRef}
                        className="w-full max-h-[200px] overflow-y-auto mx-auto rounded-large bg-gray-500 p-4 text-black bg-opacity-75"
                      >
                        {chatHistory.map((message) => (
                          <div
                            key={message.id}
                            className={`p-2 ${
                              message.type === "user"
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            <span
                              className={`
                            inline-block p-2 rounded 
                            ${message.type === "user" ? "bg-gray-200" : "bg-gray-300"}
                            ${message.status === "partial" ? "opacity-50" : ""}
                          `}
                            >
                              <Markdown>{message.text}</Markdown>
                            </span>
                          </div>
                        ))}
                      </div>
                      <InteractiveAvatarTextInput
                        disabled={!stream}
                        input={text}
                        label="Chat"
                        loading={isLoadingRepeat}
                        placeholder="Type something for the avatar to respond"
                        setInput={setText}
                        onSubmit={handleSpeak}
                      />
                      {text && (
                        <Chip className="absolute right-16 top-3">
                          Listening
                        </Chip>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div
                        ref={chatStatusRef}
                        className="bg-black/50 rounded-[60px] min-w-[20%] flex justify-center gap-2 items-center px-8 py-2"
                      >
                        <Tooltip content="Listening">
                          <EarIcon ref={earSvgRef} />
                        </Tooltip>
                        <Tooltip content="Thinking">
                          <BrainIcon ref={brainSvgRef} />
                        </Tooltip>
                        <Tooltip content="Speaking">
                          <TalkIcon ref={talkSvgRef} />
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </CardFooter>
              </div>
            ) : !isLoadingSession ? (
              <div className="h-screen w-screen justify-end items-center flex flex-col gap-8 self-center">
                {splitTest ? (
                  <>
                    <Button
                      className="bg-gradient-to-tr from-red-600 to-red-950 text-white w-auto pt-3 pb-3 pl-6 pr-6 font-bold mb-3 h-auto pulse transition-all duration-500 max-w-[90%]"
                      id="start-session-button"
                      size="lg"
                      variant="shadow"
                      onPress={() => {
                        startSession();
                      }}
                    >
                      <span
                        className={`transition-opacity duration-500 ${isAnimating ? "opacity-0" : "opacity-100"} text-xl sm:text-3xl whitespace-normal text-center max-w-[300px] sm:max-w-none`}
                      >
                        {ctaTexts[currentCtaIndex]}
                      </span>
                    </Button>
                    {/* Simplified SuggestionChips with internal suggestion data */}
                    <SuggestionChips
                      count={3} // Show 3 random suggestions each time
                      onSelect={(prompt) => startSession(prompt)}
                    />
                  </>
                ) : (
                  <Button
                    className="bg-gradient-to-tr from-red-600 to-red-950 text-white w-auto pt-3 pb-3 pl-6 pr-6 font-bold mb-3 h-auto pulse transition-all duration-500"
                    id="start-session-button"
                    size="lg"
                    variant="shadow"
                    onPress={() => {
                      startSession();
                    }}
                  >
                    Talk
                  </Button>
                )}
              </div>
            ) : null}
            {/* Intro video overlay – завжди в DOM */}
            <div
              className={clsx(
                "fixed inset-0 overflow-hidden flex items-center justify-center z-20 transition-opacity duration-300",
                isLoadingSession
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none",
              )}
            >
              {!isIOS() && (
                <video
                  ref={introVideoRef}
                  playsInline
                  className={clsx(
                    "absolute bg-center mx-auto my-auto",
                    isMobile
                      ? "h-auto w-screen left-0 right-0"
                      : "h-screen w-auto top-0 bottom-0",
                  )}
                  preload="auto"
                  src={isMobile ? "/AZa-intro-mob.mp4" : "/AZa-intro.mp4"}
                  style={{ backgroundImage: "url('/AZa-bg.webp')" }}
                  onPause={() => {
                    const v = introVideoRef.current;

                    if (!v) return;
                    if (v.ended) return;
                    if (document.visibilityState === "hidden") return;
                    v.play().catch(() => {});
                  }}
                >
                  <track kind="captions" />
                </video>
              )}
              <Spinner />
            </div>
          </CardBody>
        </Card>
        <EmailFormDialog
          isOpen={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          onSend={sendChatHistoryEmail}
        />
        <SessionLimitModal
          isOpen={isSessionLimitReached}
          timeRemaining={timeUntilNextSession}
          onClose={() => setIsSessionLimitReached(false)}
        />
        {YouTubeModalComponent}
      </div>
    );
  }
}
