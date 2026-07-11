import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageLoader, EmptyState } from '../components/ui';

const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export default function Chat() {
  const { interestRequestId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    api.chatRooms().then((r) => setRooms(r.rooms)).catch((e) => toast.error(e.message));
  }, [toast]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Messages</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        {/* Rooms list — hidden on mobile when a conversation is open */}
        <div className={`card overflow-hidden ${interestRequestId ? 'hidden md:block' : ''}`}>
          {rooms === null ? <PageLoader /> : rooms.length === 0 ? (
            <div className="p-4"><EmptyState title="No conversations" subtitle="Chats open once an interest is accepted." /></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <li key={r.interest_request_id}>
                  <Link to={`/chat/${r.interest_request_id}`}
                    className={`block px-4 py-3 transition-colors hover:bg-slate-50 ${r.interest_request_id === interestRequestId ? 'bg-brand-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{r.chat_partner_name}</span>
                      {Number(r.unread_count) > 0 && (
                        <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{r.unread_count}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">{r.location}</p>
                    {r.last_message && <p className="mt-0.5 truncate text-xs text-slate-400">{r.last_message}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conversation */}
        <div className={`card ${interestRequestId ? '' : 'hidden md:block'}`}>
          {interestRequestId ? (
            <ChatWindow key={interestRequestId} id={interestRequestId} onBack={() => navigate('/chat')} />
          ) : (
            <div className="grid h-full min-h-[300px] place-items-center text-sm text-slate-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatWindow({ id, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
  };

  useEffect(() => {
    let active = true;
    const socket = getSocket();

    // Load history, then join the live room
    api.chatMessages(id)
      .then((res) => { if (active) { setMessages(res.messages); scrollToBottom(); } })
      .catch((e) => { if (active) { toast.error(e.message); setMessages([]); } });

    socket.emit('join_room', { interest_request_id: id });

    const onReceive = (msg) => {
      if (msg.interest_request_id !== id) return;
      setMessages((prev) => [...(prev || []), msg]);
      scrollToBottom();
    };
    const onError = (err) => toast.error(err.message || 'Chat error');

    socket.on('receive_message', onReceive);
    socket.on('error', onError);

    return () => {
      active = false;
      socket.off('receive_message', onReceive);
      socket.off('error', onError);
    };
  }, [id, toast]);

  const send = (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    getSocket().emit('send_message', { content });
    setText('');
  };

  if (messages === null) return <PageLoader />;

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 md:hidden">
        <button onClick={onBack} className="text-slate-500">← Back</button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-400">No messages yet. Say hello 👋</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>{time(m.sent_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…" />
        <button className="btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
