/**
 * SMS Ethiopia Integration Module
 *
 * This module provides functions to send SMS messages using the SMS Ethiopia API.
 * Currently, it logs simulated requests since the API key is not yet available.
 * It is structurally ready to be implemented once the credentials are provided.
 */

interface SendSmsOptions {
  to: string;
  message: string;
}

interface SendSmsResponse {
  success: boolean;
  providerResponse: any;
  error?: string;
}

/**
 * Sends an SMS message to a given phone number.
 *
 * @param options - The SMS options containing the recipient phone number and the message.
 * @returns A promise that resolves to the result of the SMS request.
 */
export async function sendSms({ to, message }: SendSmsOptions): Promise<SendSmsResponse> {
  const apiKey = process.env.SMS_ETHIOPIA_API_KEY;

  if (!apiKey) {
    console.log(`[SMS Simulation] Would send to ${to}: "${message}"`);
    console.log('[SMS Simulation] Returning simulated success response.');
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      success: true,
      providerResponse: {
        status: 'simulated_success',
        message: 'Message sent successfully (simulated)',
        recipient: to,
        timestamp: new Date().toISOString(),
      },
    };
  }

  try {
    // Structure for actual SMS Ethiopia API integration once the API key is available
    // Replace with the actual API endpoint and payload structure
    const response = await fetch('https://api.sms-ethiopia.com/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to,
        message,
        sender: 'Lazim Rent' // Adjust this when Sender ID is approved
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[SMS API Error]', data);
      return {
        success: false,
        providerResponse: data,
        error: data.message || 'Failed to send SMS',
      };
    }

    return {
      success: true,
      providerResponse: data,
    };
  } catch (error: any) {
    console.error('[SMS Error]', error);
    return {
      success: false,
      providerResponse: null,
      error: error.message || 'An unexpected error occurred while sending SMS',
    };
  }
}
