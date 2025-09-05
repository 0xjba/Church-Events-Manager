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
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

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

## 🚀 Deployment

### Netlify
1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automatically on push to main branch

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
