# PYPA Devotional Events Pro

Professional devotional events management platform with real-time scoring and results.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.19.0 or higher
- npm 8.0.0 or higher

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd devotional-events-pro

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your actual Supabase credentials
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

The key variable is `VITE_SUPABASE_PUBLISHABLE_KEY`; the app refuses to start
without it. Its value is the project's anon key, which is public by design —
what protects the data is row-level security, not secrecy of that key.

**⚠️ Security Note**: Never commit your `.env` file to version control. It's already added to `.gitignore`.

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## 🔒 Security

This application uses environment variables for sensitive configuration. Ensure:

1. **Never commit `.env` files** to version control
2. **Rotate Supabase keys** if they've been exposed
3. **Use environment variables** in production deployments
4. **Keep secrets secure** and local only

### Auth model

Admins sign in through Supabase Auth. Judges and participants use a separate
username/password login handled by the `participant-auth` edge function, which
issues a token Postgres cannot verify. Anything those users read or write that
is not public therefore goes through an edge function running with the service
role, never straight from the browser:

| Table | Browser access |
| --- | --- |
| `user_credentials` | none, service role only |
| `scores` | admins via their session; everyone else read-only once results are published |
| `participants`, `judges`, `events` | readable; writable by admins only |

Passwords are hashed with PBKDF2-SHA256 (210k iterations, per-user salt) inside
the edge function. Hashes created by the old scheme still work at login and are
upgraded in place the first time the account signs in.

### Applying the security migration

```bash
supabase db push
supabase functions deploy participant-auth
supabase functions deploy scores
supabase secrets set JWT_SECRET=... ALLOWED_ORIGINS=https://your-site LEGACY_PASSWORD_SALT=pypa-salt
```

The migration moves password hashes into `user_credentials` and drops the
`password_hash` columns, so deploy the functions in the same window as the
migration. Because the old hashes were readable by anyone holding the public
anon key, treat every existing password as compromised and reset them from the
admin screens afterwards.

## 🚀 Deployment

### Netlify

1. Connect the repository; `netlify.toml` already sets the build command,
   publish directory, SPA redirect and security headers.
2. Set the build environment variables in the Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy. Then tell the edge functions which origin to accept, or every call a
   judge's browser makes is refused by CORS:

   ```bash
   supabase secrets set ALLOWED_ORIGINS=http://localhost:8080,https://your-site.netlify.app
   ```

4. Check the deployed site: sign in as an admin, and confirm the leaderboard
   loads. A CORS failure shows as a login that never completes.

### Manual Deployment
```bash
npm run build
# Deploy the `dist` folder to your hosting provider
```

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite
- **UI Library**: Ant Design
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **State Management**: React Query + Context API

## 📱 Features

- **Admin Dashboard**: Event management, participant registration, judge assignment
- **Judge Interface**: Real-time scoring with timer and criteria management
- **Participant Portal**: Event registration and result viewing
- **Real-time Updates**: Live scoreboard and activity tracking
- **PWA Support**: Progressive Web App capabilities

## 🔧 Development

### Project Structure
```
src/
├── components/     # Reusable UI components
├── hooks/         # Custom React hooks
├── integrations/  # External service integrations
├── pages/         # Application pages
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
```

### Key Technologies
- **React 18** with modern hooks
- **TypeScript** for type safety
- **Vite** for fast development and building
- **Supabase** for backend services
- **Ant Design** for UI components
- **Tailwind CSS** for styling

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🆘 Support

For support and questions, please contact the development team.
