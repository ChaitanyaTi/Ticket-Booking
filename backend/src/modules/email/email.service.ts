import QRCode from 'qrcode';
import { config } from '../../config';
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.appPassword,
    },
  });
  return transporter;
}

async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  
  // Basic text fallback to improve deliverability
  const text = subject + '\n\nPlease view this email in an HTML-compatible client to see your ticket details and QR code.';
  
  await t.sendMail({
    from: `"Ticket Booking" <${config.gmail.user}>`,
    to,
    subject,
    text,
    html,
  });
  console.log('--------------------------------------------------');
  console.log(`📧 Email Sent to: ${to} | Subject: ${subject}`);
  console.log('--------------------------------------------------');
}


export interface BookingEmailData {
  bookingRef: string;
  userName: string;
  userEmail: string;
  eventTitle: string;
  eventType: string;
  venueName: string;
  venueAddress: string;
  showDate: Date;
  showTime: string;
  seats: Array<{ rowLabel: string; seatNumber: number; categoryName: string }>;
  totalAmount: number;
}

export interface WaitlistOfferEmailData {
  offerToken: string;
  userName: string;
  userEmail: string;
  eventTitle: string;
  eventType: string;
  venueName: string;
  venueAddress: string;
  showDate: Date;
  showTime: string;
  seat: { rowLabel: string; seatNumber: number; categoryName: string };
  expiresAt: Date;
  offerUrl: string;
}

export async function generateQRCode(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: {
      dark: '#0F1225',
      light: '#FFB627',
    },
  });
}

function formatCurrency(amount: number): string {
  return `₹${(amount / 100).toLocaleString('en-IN')}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const qrData = JSON.stringify({ bookingRef: data.bookingRef, type: 'booking' });
  const qrCodeImage = await generateQRCode(qrData);

  const seatsHtml = data.seats
    .map(
      (s) =>
        `<tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #333;">${s.categoryName}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #333; font-family: monospace;">Row ${s.rowLabel}, Seat ${s.seatNumber}</td>
        </tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F1225; color: #F5F3EE;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 700; color: #F5F3EE;">
            <span style="color: #FFB627;">■</span>
            <span>Ticket Booking</span>
          </div>
        </div>

        <!-- Main Card -->
        <div style="background: #171B33; border: 1px solid #2D3355; border-radius: 16px; overflow: hidden;">
          <!-- Event Header -->
          <div style="background: linear-gradient(135deg, #FFB627 0%, #FF4D6D 100%); padding: 24px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #0F1225; text-transform: uppercase; letter-spacing: 1px;">Booking Confirmed</p>
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0F1225;">${data.eventTitle}</h1>
            <p style="margin: 8px 0 0; font-size: 16px; color: #0F1225; opacity: 0.8;">${data.eventType} • ${formatDate(data.showDate)} at ${data.showTime}</p>
          </div>

          <!-- QR Code -->
          <div style="padding: 32px 24px; text-align: center;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #9498B3; text-transform: uppercase; letter-spacing: 1px;">Your Ticket QR Code</p>
            <img src="${qrCodeImage}" alt="QR Code for booking ${data.bookingRef}" style="max-width: 100%; height: auto; border-radius: 8px; background: #0F1225; padding: 16px;" />
            <p style="margin: 16px 0 0; font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; color: #FFB627; letter-spacing: 2px;">${data.bookingRef}</p>
          </div>

          <!-- Details -->
          <div style="padding: 0 24px 24px;">
            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #9498B3; text-transform: uppercase; letter-spacing: 1px;">Venue</p>
              <p style="margin: 0; font-size: 16px; color: #F5F3EE; font-weight: 500;">${data.venueName}</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #9498B3;">${data.venueAddress}</p>
            </div>

            <div style="margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 14px; color: #9498B3; text-transform: uppercase; letter-spacing: 1px;">Seats</p>
              <table style="width: 100%; border-collapse: collapse; background: #0F1225; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #1E2540;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #9498B3; text-transform: uppercase; letter-spacing: 0.5px;">Category</th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #9498B3; text-transform: uppercase; letter-spacing: 0.5px;">Seat</th>
                  </tr>
                </thead>
                <tbody>
                  ${seatsHtml}
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid #2D3355;">
              <span style="font-size: 14px; color: #9498B3;">Total Paid</span>
              <span style="font-family: 'IBM Plex Mono', monospace; font-size: 24px; font-weight: 700; color: #FFB627;">${formatCurrency(data.totalAmount)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; padding: 0 20px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #9498B3;">Show this QR code at the venue for entry.</p>
          <p style="margin: 0; font-size: 12px; color: #5A5E7A;">Booking reference: <span style="font-family: monospace;">${data.bookingRef}</span></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail(
    data.userEmail,
    `Your tickets for ${data.eventTitle} — ${data.bookingRef}`,
    html
  );
}

export async function sendWaitlistOfferEmail(data: WaitlistOfferEmailData): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F1225; color: #F5F3EE;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 700; color: #F5F3EE;">
            <span style="color: #FFB627;">■</span>
            <span>Ticket Booking</span>
          </div>
        </div>

        <!-- Main Card -->
        <div style="background: #171B33; border: 1px solid #2D3355; border-radius: 16px; overflow: hidden;">
          <!-- Offer Header -->
          <div style="background: linear-gradient(135deg, #FF4D6D 0%, #FFB627 100%); padding: 24px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #0F1225; text-transform: uppercase; letter-spacing: 1px;">Waitlist Offer</p>
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0F1225;">A seat just opened up!</h1>
            <p style="margin: 8px 0 0; font-size: 16px; color: #0F1225; opacity: 0.8;">${data.eventTitle} • ${data.eventType}</p>
          </div>

          <!-- Offer Details -->
          <div style="padding: 32px 24px; text-align: center;">
            <div style="background: #0F1225; border: 2px solid #FFB627; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #9498B3; text-transform: uppercase; letter-spacing: 1px;">Your Seat</p>
              <p style="margin: 0; font-family: 'IBM Plex Mono', monospace; font-size: 32px; font-weight: 700; color: #FFB627;">${data.seat.categoryName} — Row ${data.seat.rowLabel}, Seat ${data.seat.seatNumber}</p>
            </div>

            <div style="margin-bottom: 24px; padding: 16px; background: #1E2540; border-radius: 8px; border-left: 4px solid #FF4D6D;">
              <p style="margin: 0 0 4px; font-size: 14px; color: #FF4D6D; font-weight: 600;">⏱️ Offer expires</p>
              <p style="margin: 0; font-family: 'IBM Plex Mono', monospace; font-size: 18px; color: #F5F3EE;">${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(data.expiresAt)}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #9498B3;">You have ${config.waitlistOfferTtlMinutes} minutes to claim this seat.</p>
            </div>

            <a href="${data.offerUrl}" style="display: inline-block; background: #FFB627; color: #0F1225; font-weight: 700; font-size: 16px; padding: 16px 32px; border-radius: 8px; text-decoration: none; transition: background 0.2s;">
              Claim My Seat
            </a>
          </div>

          <!-- Event Info -->
          <div style="padding: 0 24px 24px; border-top: 1px solid #2D3355; margin-top: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <p style="margin: 0 0 4px; font-size: 12px; color: #9498B3; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
                <p style="margin: 0; font-size: 14px; color: #F5F3EE;">${formatDate(data.showDate)} at ${data.showTime}</p>
              </div>
              <div>
                <p style="margin: 0 0 4px; font-size: 12px; color: #9498B3; text-transform: uppercase; letter-spacing: 0.5px;">Venue</p>
                <p style="margin: 0; font-size: 14px; color: #F5F3EE;">${data.venueName}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; padding: 0 20px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #9498B3;">Click the button above to claim your seat before the offer expires.</p>
          <p style="margin: 0; font-size: 12px; color: #5A5E7A;">Offer token: <span style="font-family: monospace;">${data.offerToken}</span></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail(
    data.userEmail,
    `Waitlist offer: Seat available for ${data.eventTitle}`,
    html
  );
}

export async function sendBookingCancellationEmail(data: BookingEmailData): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F1225; color: #F5F3EE;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 700; color: #F5F3EE;">
            <span style="color: #FFB627;">■</span>
            <span>Ticket Booking</span>
          </div>
        </div>

        <div style="background: #171B33; border: 1px solid #2D3355; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #FF4D6D 0%, #FF8C42 100%); padding: 24px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #0F1225; text-transform: uppercase; letter-spacing: 1px;">Booking Cancelled</p>
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0F1225;">${data.eventTitle}</h1>
            <p style="margin: 8px 0 0; font-size: 16px; color: #0F1225; opacity: 0.8;">${data.eventType} • ${formatDate(data.showDate)} at ${data.showTime}</p>
          </div>

          <div style="padding: 32px 24px; text-align: center;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #F5F3EE;">Your booking <strong style="font-family: monospace;">${data.bookingRef}</strong> has been cancelled.</p>
            <p style="margin: 0; font-size: 14px; color: #9498B3;">If you didn't request this cancellation, please contact support.</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 32px; padding: 0 20px;">
          <p style="margin: 0; font-size: 12px; color: #5A5E7A;">Booking reference: <span style="font-family: monospace;">${data.bookingRef}</span></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail(
    data.userEmail,
    `Booking cancelled: ${data.eventTitle} — ${data.bookingRef}`,
    html
  );
}