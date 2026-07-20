import { sendBriefAllocationEmail } from '@/server/services/email.service';
import { Resend } from 'resend';

// Create a shared mock function for send
const mockSend = jest.fn().mockResolvedValue({ id: 'mock-email-id', error: null });

// Mock the resend module
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      };
    }),
  };
});

describe('EmailService', () => {
  beforeEach(() => {
    mockSend.mockClear();

    // Set required environment variables for the service to not skip sending
    process.env.RESEND_API_KEY = 'test_key';
    process.env.NODE_ENV = 'production'; // To prevent dev email override logic from replacing the 'to' address
  });

  it('sends an allocation email with correct parameters', async () => {
    await sendBriefAllocationEmail({
      to: 'counsel@example.com',
      counselName: 'John Doe',
      briefRef: 'REF-123',
      subject: 'Review Contract',
      urgency: 'URGENT',
      estimatedHours: 4,
      expertiseArea: 'PUBLIC_PROCUREMENT_CONTRACTS',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sendArgs = mockSend.mock.calls[0][0];
    
    expect(sendArgs.to).toEqual(['counsel@example.com']);
    expect(sendArgs.subject).toContain('REF-123');
    expect(sendArgs.html).toContain('John Doe');
    expect(sendArgs.html).toContain('Review Contract');
    expect(sendArgs.html).toContain('URGENT');
    expect(sendArgs.html).toContain('4h');
  });
});
