export interface Participant {
  name?: string;
  email: string;
}

export interface Thread {
  id: string;
  subject: string | null;
  snippet: string | null;
  is_unread: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  participants: Participant[] | null;
  last_message_at: string | null;
  message_count: number;
}

export interface EmailMessage {
  id: string;
  thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: Participant[] | null;
  cc_list: Participant[] | null;
  is_unread: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  received_at: string | null;
}

export interface ThreadDetail extends Thread {
  emails: EmailMessage[];
}
