'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import MarkdownRenderer from '../components/MarkdownRenderer';
import DiagramRenderer from '../components/DiagramRenderer';
import { getIcon } from '../components/CustomNodes';
import OperationalDiagram from '../components/OperationalDiagram';
import { exportCurrentArchToDrawIo } from '../utils/drawio';
import { toPng } from 'html-to-image';
import YAML from 'yaml';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronRight, 
  BookMarked,
  FileCode,
  LayoutGrid,
  Info,
  LogIn,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Sun,
  Moon,
  Edit3,
  Save,
  X,
  ArrowUpDown,
  Plus,
  Network,
  Server,
  Activity,
  Search,
  Trash2,
  Edit,
  Folder,
  FolderGit2,
  Settings
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface DocumentFile {
  name: string;
  displayName: string;
  number?: number;
  path: string;
}

interface ProjectData {
  name: string;
  last_updated: number;
  description: string;
  adr_count: number;
  section_count: number;
  search_score?: number;
}

interface ProjectStructure {
  project: string;
  arc42: DocumentFile[];
  adrs: DocumentFile[];
}

interface UserProfile {
  name: string;
  email: string;
  roles: string[];
  mock?: boolean;
}

const API_BASE = "http://localhost:8000";

const isaqbHelpMap: Record<number, string> = {
  1: "Clarifiez la mission du projet. Quels sont les 3 à 5 objectifs de qualité critiques (ex. performance, résilience, sécurité) ? Identifiez les parties prenantes clés et leurs attentes.",
  2: "Dressez la liste des contraintes techniques (langages, frameworks, OS), organisationnelles (budget, équipe, délais) et des conventions méthodologiques ou de codage choisies.",
  3: "Délimitez les frontières fonctionnelles (qui utilise l'application) et techniques (avec quels autres systèmes elle communique). C'est l'étape iSAQB clé du diagramme de contexte.",
  4: "Résumez les décisions technologiques structurantes du projet. Pourquoi ces choix ? Quels patrons (patterns) d'architecture (microservices, event-driven) appliquez-vous ?",
  5: "Présentez la décomposition statique du système sous forme de boîtes (Niveau 1, puis Niveau 2 et 3). Utilisez la bibliothèque de composants pour dessiner votre structure.",
  6: "Décrivez le comportement dynamique et temporel du système. Modélisez les scénarios d'exécution principaux, l'enchaînement des appels d'API ou les flux d'événements.",
  7: "Représentez l'infrastructure physique. Où s'exécutent les conteneurs, les serveurs, les clusters, les bases de données ? Décrivez la topologie réseau et le stockage.",
  8: "Détaillez les concepts transversaux réutilisés dans tout le projet (sécurité globale, authentification, observabilité/logs, gestion des erreurs, internationalisation).",
  9: "Consultez le registre des Architecture Decision Records (ADRs). Chaque choix structurant doit posséder sa propre fiche documentant le contexte, le choix et ses impacts.",
  10: "Formalisez les exigences de qualité importantes sous forme de scénarios précis (ex. sous charge de 1000 req/sec, le taux d'erreur doit être inférieur à 0.1%).",
  11: "Listez les risques d'architecture identifiés, les dettes techniques accumulées et prévoyez les plans d'atténuation correspondants.",
  12: "Définissez les termes techniques et métier clés pour créer un langage commun (Ubiquitous Language) partagé par les développeurs, les architectes et le produit."
};

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProject, setActiveProject] = useState<string>('');
  const [structure, setStructure] = useState<ProjectStructure | null>(null);
  const [activeDoc, setActiveDoc] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  
  const [splitScreen, setSplitScreen] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [iconsMap, setIconsMap] = useState<Record<string, string>>({});
  const [newIconType, setNewIconType] = useState<string>('');
  const [newIconName, setNewIconName] = useState<string>('');
  const [isSavingIcons, setIsSavingIcons] = useState<boolean>(false);
  const [nodeLabel, setNodeLabel] = useState<string>('');
  const [nodeType, setNodeType] = useState<string>('service');
  const [edgeSource, setEdgeSource] = useState<string>('');
  const [edgeTarget, setEdgeTarget] = useState<string>('');
  const [edgeLabel, setEdgeLabel] = useState<string>('');
  const [activeHelperTab, setActiveHelperTab] = useState<'none' | 'node' | 'edge'>('none');

  // Operational Services Architecture States
  const [currentView, setCurrentView] = useState<'projects' | 'current_architecture'>('current_architecture');
  const [currentArchServices, setCurrentArchServices] = useState<any[]>([]);
  const [currentArchNamespaces, setCurrentArchNamespaces] = useState<any[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('All');
  const [searchServiceQuery, setSearchServiceQuery] = useState<string>('');
  const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
  const [showNamespaceModal, setShowNamespaceModal] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<any | null>(null);

  // Documentation Versioning States
  const [activeVersion, setActiveVersion] = useState<string>('DRAFT');
  const [projectVersions, setProjectVersions] = useState<string[]>(['DRAFT']);
  const [isFreezingVersion, setIsFreezingVersion] = useState<boolean>(false);

  const handleCreateNewVersion = async () => {
    if (!activeProject) return;
    if (!confirm("Voulez-vous figer l'état actuel de la documentation dans une nouvelle version ?\nCette opération est manuelle et créera un instantané figé.")) {
      return;
    }

    setIsFreezingVersion(true);
    try {
      const res = await fetch(`${API_BASE}/api/docs/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: activeProject }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Version '${data.version}' créée avec succès !`);
        setActiveVersion(data.version);
      } else {
        const err = await res.json();
        alert(`Erreur : ${err.detail || "Erreur de création"}`);
      }
    } catch (e) {
      alert("Erreur réseau");
    } finally {
      setIsFreezingVersion(false);
    }
  };

  // Reset activeVersion to 'DRAFT' when activeProject changes
  useEffect(() => {
    setActiveVersion('DRAFT');
  }, [activeProject]);

  // Form fields for adding/editing a service
  const [serviceName, setServiceName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [serviceNamespace, setServiceNamespace] = useState('Core');
  const [serviceType, setServiceType] = useState('service');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceVersion, setServiceVersion] = useState('1.0.0');
  const [serviceStatus, setServiceStatus] = useState('active');

  // Form fields for namespace
  const [namespaceName, setNamespaceName] = useState('');
  const [namespaceDescription, setNamespaceDescription] = useState('');

  // Operational Architecture Versioning States
  const [currentArchVersion, setCurrentArchVersion] = useState<string>('DRAFT');
  const [currentArchVersionsList, setCurrentArchVersionsList] = useState<string[]>(['DRAFT']);
  const [isFreezingCurrentArch, setIsFreezingCurrentArch] = useState<boolean>(false);
  const [currentArchConnections, setCurrentArchConnections] = useState<any[]>([]);

  // Connection management states
  const [showConnectionModal, setShowConnectionModal] = useState<boolean>(false);
  const [connectionFrom, setConnectionFrom] = useState('');
  const [connectionTo, setConnectionTo] = useState('');
  const [connectionLabel, setConnectionLabel] = useState('');

  // System namespaces filtering states
  const [hideSystemNamespaces, setHideSystemNamespaces] = useState<boolean>(false);
  const [isNamespaceSystem, setIsNamespaceSystem] = useState<boolean>(false);

  const handleCreateNewCurrentArchVersion = async () => {
    if (!confirm("Voulez-vous figer l'état actuel de la cartographie (DRAFT) dans une nouvelle version ?\nCette opération est manuelle et créera un instantané figé.")) {
      return;
    }

    setIsFreezingCurrentArch(true);
    try {
      const res = await fetch(`${API_BASE}/api/current-architecture/version`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Version d'architecture '${data.version}' créée avec succès !`);
        setCurrentArchVersion(data.version);
      } else {
        const err = await res.json();
        alert(`Erreur : ${err.detail || "Erreur de création"}`);
      }
    } catch (e) {
      alert("Erreur réseau");
    } finally {
      setIsFreezingCurrentArch(false);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionFrom || !connectionTo) {
      alert("La source et la cible du lien sont obligatoires.");
      return;
    }
    if (connectionFrom === connectionTo) {
      alert("Un service ne peut pas communiquer avec lui-même.");
      return;
    }

    if (currentArchConnections.some(c => c.from === connectionFrom && c.to === connectionTo)) {
      alert("Ce lien de communication existe déjà.");
      return;
    }

    const newConnection = {
      from: connectionFrom,
      to: connectionTo,
      label: connectionLabel.trim()
    };

    const updatedConnections = [...currentArchConnections, newConnection];

    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: currentArchNamespaces,
          services: currentArchServices,
          connections: updatedConnections 
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchConnections(updatedConnections);
        setShowConnectionModal(false);
        setConnectionFrom('');
        setConnectionTo('');
        setConnectionLabel('');
      } else {
        alert("Erreur lors de la création de la liaison.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleDeleteConnection = async (fromSvc: string, toSvc: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer la liaison de communication entre '${fromSvc}' et '${toSvc}' ?`)) {
      return;
    }

    const updatedConnections = currentArchConnections.filter(c => !(c.from === fromSvc && c.to === toSvc));

    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: currentArchNamespaces,
          services: currentArchServices,
          connections: updatedConnections 
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchConnections(updatedConnections);
      } else {
        alert("Erreur lors de la suppression de la liaison.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const fetchCurrentArch = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/current-architecture?version=${encodeURIComponent(currentArchVersion)}`, 
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setCurrentArchServices(data.services || []);
        setCurrentArchNamespaces(data.namespaces || []);
        setCurrentArchConnections(data.connections || []);
        setCurrentArchVersionsList(data.versions || ['DRAFT']);
      }
    } catch (err) {
      console.error("Failed to load current architecture:", err);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !serviceNamespace.trim()) {
      alert("Le nom et le namespace du service sont obligatoires.");
      return;
    }

    const finalId = serviceId.trim() || serviceName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const newService = {
      id: finalId,
      name: serviceName.trim(),
      namespace: serviceNamespace.trim(),
      type: serviceType,
      description: serviceDescription.trim(),
      version: serviceVersion.trim() || '1.0.0',
      status: serviceStatus
    };

    let updatedList = [...currentArchServices];
    if (editingService) {
      updatedList = updatedList.map(s => s.id === editingService.id ? newService : s);
    } else {
      if (updatedList.some(s => s.id === finalId)) {
        alert(`Un service avec l'identifiant '${finalId}' existe déjà.`);
        return;
      }
      updatedList.push(newService);
    }

    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: currentArchNamespaces, 
          services: updatedList,
          connections: currentArchConnections
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchServices(updatedList);
        setShowServiceModal(false);
        setEditingService(null);
        setServiceName('');
        setServiceId('');
        setServiceDescription('');
        setServiceVersion('1.0.0');
        setServiceStatus('active');
      } else {
        alert("Erreur lors de l'enregistrement du service.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce service de la cartographie ?")) {
      return;
    }
    const updatedList = currentArchServices.filter(s => s.id !== id);
    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: currentArchNamespaces, 
          services: updatedList,
          connections: currentArchConnections
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchServices(updatedList);
      } else {
        alert("Erreur lors de la suppression du service.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleSaveNamespace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namespaceName.trim()) {
      alert("Le nom du namespace est obligatoire.");
      return;
    }

    const nameNormalized = namespaceName.trim();

    if (currentArchNamespaces.some(n => n.name.toLowerCase() === nameNormalized.toLowerCase())) {
      alert(`Un namespace avec le nom '${nameNormalized}' existe déjà.`);
      return;
    }

    const newNamespace = {
      name: nameNormalized,
      description: namespaceDescription.trim() || `Groupe de services ${nameNormalized}`,
      isSystem: isNamespaceSystem
    };

    const updatedNamespaces = [...currentArchNamespaces, newNamespace];

    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: updatedNamespaces,
          services: currentArchServices,
          connections: currentArchConnections
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchNamespaces(updatedNamespaces);
        setShowNamespaceModal(false);
        setNamespaceName('');
        setNamespaceDescription('');
        setIsNamespaceSystem(false);
      } else {
        alert("Erreur lors de la création du namespace.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleDeleteNamespace = async (name: string) => {
    const affectedServices = currentArchServices.filter(s => s.namespace === name);
    let confirmMsg = `Voulez-vous vraiment supprimer le namespace '${name}' ?`;
    if (affectedServices.length > 0) {
      confirmMsg = `⚠️ ATTENTION : Le namespace '${name}' contient ${affectedServices.length} service(s) (ex: ${affectedServices[0].name}).\nSupprimer ce namespace supprimera également TOUS ses services.\nVoulez-vous continuer ?`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    const updatedNamespaces = currentArchNamespaces.filter(n => n.name !== name);
    const updatedServices = currentArchServices.filter(s => s.namespace !== name);
    const affectedServiceIds = affectedServices.map(s => s.id);
    const updatedConnections = currentArchConnections.filter(c => 
      !affectedServiceIds.includes(c.from) && !affectedServiceIds.includes(c.to)
    );

    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: updatedNamespaces,
          services: updatedServices,
          connections: updatedConnections
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchNamespaces(updatedNamespaces);
        setCurrentArchServices(updatedServices);
        if (selectedNamespace === name) {
          setSelectedNamespace('All');
        }
      } else {
        alert("Erreur lors de la suppression du namespace.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleToggleNamespaceSystem = async (name: string) => {
    const updatedNamespaces = currentArchNamespaces.map(n => 
      n.name === name ? { ...n, isSystem: !n.isSystem } : n
    );
    try {
      const res = await fetch(`${API_BASE}/api/current-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          namespaces: updatedNamespaces,
          services: currentArchServices,
          connections: currentArchConnections
        }),
        credentials: 'include'
      });
      if (res.ok) {
        setCurrentArchNamespaces(updatedNamespaces);
      } else {
        alert("Erreur lors de la modification du namespace.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    }
  };

  const handleExportDrawIo = () => {
    const xml = exportCurrentArchToDrawIo(currentArchServices, currentArchNamespaces, currentArchConnections);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture_actuelle_${currentArchVersion}.drawio`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    const element = document.getElementById('operational-flow-diagram');
    if (!element) {
      alert("Impossible de trouver le conteneur du schéma.");
      return;
    }
    
    toPng(element, {
      backgroundColor: '#0c0f12',
      skipFonts: true,
      cacheBust: true,
      filter: (node) => {
        if (
          node.classList?.contains('react-flow__controls') ||
          node.classList?.contains('react-flow__panel')
        ) {
          return false;
        }
        return true;
      }
    })
    .then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `architecture_actuelle_${currentArchVersion}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    })
    .catch((err) => {
      console.error("PNG export failed:", err);
      alert("Erreur lors de la génération de l'image PNG. Veuillez réessayer.");
    });
  };

  const handleExportCurrentArchMarkdown = () => {
    const element = document.getElementById('operational-flow-diagram');
    if (!element) {
      alert("Impossible de trouver le conteneur du schéma.");
      return;
    }
    
    toPng(element, {
      backgroundColor: '#0c0f12',
      skipFonts: true,
      cacheBust: true,
      filter: (node) => {
        if (
          node.classList?.contains('react-flow__controls') ||
          node.classList?.contains('react-flow__panel')
        ) {
          return false;
        }
        return true;
      }
    })
    .then((dataUrl) => {
      let md = `# Documentation d'Architecture Globale (Cartographie)

* **Version** : ${currentArchVersion === 'DRAFT' ? 'DRAFT (Version de travail)' : 'v' + currentArchVersion}
* **Date d'exportation** : ${new Date().toLocaleDateString('fr-FR')}
* **Auteur** : Généré automatiquement par Archi Portal

## 🗺️ Schéma Opérationnel Interactif

![Schéma Opérationnel Interactif](${dataUrl})

*Note: L'image ci-dessus est directement inlinée au format Base64 PNG.*

## 📦 Inventaire des Services Applicatifs par Groupes

`;

      const namespacesToExport = currentArchNamespaces.filter(n => n.name !== 'All');
      namespacesToExport.forEach(ns => {
        const svcs = currentArchServices.filter(s => s.namespace === ns.name);
        const sysLabel = ns.isSystem ? ' (Système / Infrastructure)' : '';
        md += `### 📁 ${ns.name}${sysLabel}\n\n`;
        if (ns.description) {
          md += `*Description : ${ns.description}*\n\n`;
        }
        
        if (svcs.length === 0) {
          md += `*Aucun service dans ce groupe.*\n\n`;
        } else {
          md += `| Identifiant | Nom du Service | Type | Version | Statut | Description |\n`;
          md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
          svcs.forEach(s => {
            const statusLabel = s.status === 'active' ? '🟢 Actif' : (s.status === 'degraded' ? '🟡 Dégradé' : '🔴 Inactif');
            md += `| \`${s.id}\` | **${s.name}** | \`${s.type}\` | \`${s.version}\` | ${statusLabel} | ${s.description || 'Aucune description.'} |\n`;
          });
          md += `\n`;
        }
      });

      md += `## 🔌 Liaisons de Flux et Echanges de Données\n\n`;
      if (currentArchConnections.length === 0) {
        md += `*Aucune liaison déclarée.*\n\n`;
      } else {
        md += `| Service Émetteur | | Service Récepteur | Protocole / Description |\n`;
        md += `| :--- | :---: | :--- | :--- |\n`;
        currentArchConnections.forEach(c => {
          const srcName = currentArchServices.find(s => s.id === c.from)?.name || c.from;
          const tgtName = currentArchServices.find(s => s.id === c.to)?.name || c.to;
          md += `| **${srcName}** (\`${c.from}\`) | ➜ | **${tgtName}** (\`${c.to}\`) | ${c.label ? '`' + c.label + '`' : '*Non spécifié*'} |\n`;
        });
        md += `\n`;
      }

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_architecture_actuelle_${currentArchVersion}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error("Markdown export failed during snapshot:", err);
      alert("Erreur lors de la génération du rapport Markdown.");
    });
  };

  const convertDiagramYamlToMermaid = (markdownContent: string): string => {
    return markdownContent.replace(/```([^\n\r]*)\r?\n([\s\S]*?)\r?\n```/g, (match, lang, code) => {
      const isArchitecture = 
        (lang && lang.includes('type=architecture-diagram')) ||
        (code.includes('nodes:') && (code.includes('edges:') || code.includes('connections:')));
  
      if (!isArchitecture) {
        return match;
      }
  
      try {
        const parsed = YAML.parse(code);
        const nodes = parsed.nodes || [];
        const edges = parsed.edges || parsed.connections || [];
  
        if (nodes.length === 0) {
          return match;
        }
  
        let mermaid = `\`\`\`mermaid\nflowchart TD\n`;
  
        const getEmojiForType = (type: string) => {
          const t = type?.toLowerCase() || '';
          if (t === 'user') return '👥 ';
          if (t === 'browser' || t === 'client') return '💻 ';
          if (t === 'gateway' || t === 'api_gateway') return '🔀 ';
          if (t === 'database' || t === 'db') return '🗄️ ';
          if (t === 'queue' || t === 'broker') return '📥 ';
          if (t === 'cache') return '⚡ ';
          if (t === 'server') return '🖥️ ';
          if (t === 'external' || t === 'third-party') return '☁️ ';
          if (t === 'assistant') return '🤖 ';
          if (t === 'system') return '⚙️ ';
          return '📦 ';
        };
  
        nodes.forEach((n: any) => {
          const nodeId = n.id;
          const nodeLabel = n.label || nodeId;
          const nodeType = n.type || 'service';
          const emoji = getEmojiForType(nodeType);
          const safeLabel = `${emoji}${nodeLabel}`.replace(/"/g, '\\"');
  
          const tLower = nodeType.toLowerCase();
          if (tLower === 'database' || tLower === 'db') {
            mermaid += `  ${nodeId}[("${safeLabel}")]\n`;
          } else if (tLower === 'user') {
            mermaid += `  ${nodeId}("${safeLabel}")\n`;
          } else {
            mermaid += `  ${nodeId}["${safeLabel}"]\n`;
          }
        });
  
        mermaid += '\n';
  
        edges.forEach((e: any) => {
          const source = e.source || e.from;
          const target = e.target || e.to;
          const edgeLabel = e.label || '';
  
          if (!source || !target) return;
  
          if (edgeLabel) {
            const safeLinkLabel = edgeLabel.replace(/"/g, '\\"');
            mermaid += `  ${source} -- "${safeLinkLabel}" --> ${target}\n`;
          } else {
            mermaid += `  ${source} --> ${target}\n`;
          }
        });
  
        mermaid += `\`\`\``;
        return mermaid;
      } catch (err) {
        console.error("Failed to convert diagram to Mermaid:", err);
        return match;
      }
    });
  };
  
  const handleExportProjectMarkdown = async () => {
    if (!activeProject || !structure) return;
    
    const confirmExport = confirm(`Voulez-vous compiler et exporter la documentation du projet '${activeProject}' (${activeVersion}) en un seul fichier Markdown ?`);
    if (!confirmExport) return;
    
    try {
      let consolidatedMd = `# Dossier d'Architecture : ${activeProject.toUpperCase()}

 
* **Version** : ${activeVersion === 'DRAFT' ? 'DRAFT (Version de travail)' : 'v' + activeVersion}
* **Date d'exportation** : ${new Date().toLocaleDateString('fr-FR')}
 
---
 
`;
 
      const arc42Files = structure.arc42 || [];
      const arc42Contents = await Promise.all(
        arc42Files.map(async (file) => {
          try {
            const res = await fetch(
              `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&file=${encodeURIComponent(file.path)}&version=${encodeURIComponent(activeVersion)}`,
              { credentials: 'include' }
            );
            if (res.ok) {
              const data = await res.json();
              const text = data.content || '';
              const cleanText = convertDiagramYamlToMermaid(text);
              return { name: file.displayName || file.name, text: cleanText };
            }
          } catch (e) {
            console.error("Failed to fetch section:", file.path, e);
          }
          return { name: file.name, text: `*Erreur de chargement pour la section ${file.name}*` };
        })
      );
 
      consolidatedMd += `## 📖 Modèle de Documentation arc42\n\n`;
      arc42Contents.forEach(section => {
        consolidatedMd += `### 📂 ${section.name}\n\n`;
        consolidatedMd += `${section.text}\n\n`;
        consolidatedMd += `---\n\n`;
      });
 
      const adrFiles = structure.adrs || [];
      if (adrFiles.length > 0) {
        const adrContents = await Promise.all(
          adrFiles.map(async (file) => {
            try {
              const res = await fetch(
                `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&file=${encodeURIComponent(file.path)}&version=${encodeURIComponent(activeVersion)}`,
                { credentials: 'include' }
              );
              if (res.ok) {
                const data = await res.json();
                const text = data.content || '';
                const cleanText = convertDiagramYamlToMermaid(text);
                return { name: file.displayName || file.name, text: cleanText };
              }
            } catch (e) {
              console.error("Failed to fetch ADR:", file.path, e);
            }
            return { name: file.name, text: `*Erreur de chargement pour l'ADR ${file.name}*` };
          })
        );
 
        consolidatedMd += `## ⚡ Architecture Decision Records (ADRs)\n\n`;
        adrContents.forEach(adr => {
          consolidatedMd += `### 📄 ${adr.name}\n\n`;
          consolidatedMd += `${adr.text}\n\n`;
          consolidatedMd += `---\n\n`;
        });
      }
 
      const blob = new Blob([consolidatedMd], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier_architecture_${activeProject}_${activeVersion}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to consolidate project documentation:", err);
      alert("Erreur lors de l'exportation du dossier de documentation.");
    }
  };

  const simpleMarkdownToHtml = (md: string): string => {
    let html = md;
    
    // Minimal escape for rendering tags safely
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  
    // Headings
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  
    // Bold / Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
    // Rules
    html = html.replace(/^---$/gim, '<hr/>');
  
    // Code Blocks
    html = html.replace(/```(mermaid|yaml type=architecture-diagram|yaml|json|javascript|typescript|bash|sh|markdown|html|css)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
      if (lang === 'mermaid') {
        return `<div style="background: #f3f4f6; border-left: 4px solid #8b5cf6; padding: 12px; font-family: monospace; font-size: 10px; margin: 12px 0; white-space: pre-wrap;">[Diagramme Mermaid: Flowchart]\n${code}</div>`;
      }
      return `<pre style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; margin: 12px 0; overflow-x: auto; white-space: pre-wrap;"><code>${code}</code></pre>`;
    });
  
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code style="background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>');
  
    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #d1d5db; padding-left: 12px; color: #6b7280; font-style: italic; margin: 12px 0;">$1</blockquote>');
  
    // Bullet Lists
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
    
    // Basic Markdown Tables support
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) {
          continue;
        }
        const cols = line.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) {
          inTable = true;
          tableHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0;"><thead><tr>';
          cols.forEach(c => {
            tableHtml += `<th style="border:1px solid #e5e7eb; padding:8px; background:#f9fafb; font-weight:600; text-align:left; font-size:11px;">${c}</th>`;
          });
          tableHtml += '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>';
          cols.forEach(c => {
            tableHtml += `<td style="border:1px solid #e5e7eb; padding:8px; font-size:11px;">${c}</td>`;
          });
          tableHtml += '</tr>';
        }
        lines[i] = '';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</tbody></table>';
          lines[i] = tableHtml + '\n' + lines[i];
        }
      }
    }
    html = lines.join('\n');
    html = html.replace(/\n\n/g, '<br/><br/>');
  
    return html;
  };

  const handleExportCurrentArchPdf = () => {
    const element = document.getElementById('operational-flow-diagram');
    if (!element) {
      alert("Impossible de trouver le conteneur du schéma.");
      return;
    }

    const confirmExport = confirm(`Voulez-vous générer le document PDF complet pour la cartographie actuelle (${currentArchVersion}) ?`);
    if (!confirmExport) return;

    toPng(element, {
      backgroundColor: '#0c0f12',
      skipFonts: true,
      cacheBust: true,
      filter: (node) => {
        if (
          node.classList?.contains('react-flow__controls') ||
          node.classList?.contains('react-flow__panel')
        ) {
          return false;
        }
        return true;
      }
    })
    .then(async (dataUrl) => {
      const parentWrapper = document.createElement('div');
      parentWrapper.style.position = 'fixed';
      parentWrapper.style.left = '0';
      parentWrapper.style.top = '0';
      parentWrapper.style.width = '794px';
      parentWrapper.style.height = '100%';
      parentWrapper.style.zIndex = '-9999';
      parentWrapper.style.overflow = 'hidden';
      parentWrapper.style.background = 'transparent';

      const tempContainer = document.createElement('div');
      tempContainer.style.width = '794px';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.background = '#ffffff';
      tempContainer.style.color = '#000000';
      tempContainer.style.padding = '56px';
      tempContainer.style.fontFamily = 'Arial, Helvetica, sans-serif';

      const styleTag = document.createElement('style');
      styleTag.innerHTML = `
        .pdf-document { font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.2px !important; word-spacing: 1px !important; }
        .pdf-document h1, .pdf-document h2, .pdf-document h3, .pdf-document h4 { line-height: 1.4 !important; letter-spacing: 0.2px !important; word-spacing: 1.5px !important; font-family: Arial, Helvetica, sans-serif !important; }
        .pdf-document h1 { font-size: 22px; margin-bottom: 12px; color: #111827; font-weight: bold; }
        .pdf-document h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; color: #1f2937; font-weight: bold; }
        .pdf-document h3 { font-size: 14px; margin-top: 18px; color: #374151; font-weight: bold; }
        .pdf-document p { font-size: 12px; line-height: 1.6; color: #4b5563; }
        .pdf-document table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-top: 12px; margin-bottom: 16px; word-break: break-word !important; }
        .pdf-document th, .pdf-document td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 11px; }
        .pdf-document th { background-color: #f9fafb; font-weight: 600; color: #374151; }
        .pdf-document img { max-width: 100% !important; height: auto !important; display: block; margin: 20px auto; border-radius: 8px; border: 1px solid #e5e7eb; }
        .pdf-document .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
        .pdf-document .badge-active { background-color: #d1fae5; color: #065f46; }
        .pdf-document .badge-degraded { background-color: #fef3c7; color: #92400e; }
        .pdf-document .badge-inactive { background-color: #fee2e2; color: #991b1b; }
        .pdf-document .meta-info { font-size: 11px; color: #6b7280; margin-bottom: 30px; }
      `;
      tempContainer.appendChild(styleTag);

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'pdf-document';

      let html = `
        <h1 style="font-size: 22px !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.5px !important; word-spacing: 3px !important; line-height: 1.4 !important; color: #111827; margin-bottom: 12px;">Documentation d'Architecture Globale (Cartographie)</h1>
        <div class="meta-info">
          <strong>Version :</strong> ${currentArchVersion === 'DRAFT' ? 'DRAFT (Version de travail)' : 'v' + currentArchVersion}<br/>
          <strong>Date d'exportation :</strong> ${new Date().toLocaleDateString('fr-FR')}<br/>
          <strong>Générateur :</strong> Archi Portal
        </div>
        
        <h2>🗺️ Schéma Opérationnel</h2>
        <img src="${dataUrl}" alt="Schéma Opérationnel" />
        
        <h2>📦 Inventaire des Services Applicatifs par Groupes</h2>
      `;

      const namespacesToExport = currentArchNamespaces.filter(n => n.name !== 'All');
      namespacesToExport.forEach(ns => {
        const svcs = currentArchServices.filter(s => s.namespace === ns.name);
        const sysLabel = ns.isSystem ? ' (Système / Infrastructure)' : '';
        html += `
          <h3>📁 Groupe : ${ns.name}${sysLabel}</h3>
          ${ns.description ? `<p><em>${ns.description}</em></p>` : ''}
        `;

        if (svcs.length === 0) {
          html += `<p><em>Aucun service dans ce groupe.</em></p>`;
        } else {
          html += `
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Identifiant</th>
                  <th style="width: 20%;">Nom du Service</th>
                  <th style="width: 15%;">Type</th>
                  <th style="width: 10%;">Version</th>
                  <th style="width: 10%;">Statut</th>
                  <th style="width: 30%;">Description</th>
                </tr>
              </thead>
              <tbody>
          `;
          svcs.forEach(s => {
            const badgeClass = s.status === 'active' ? 'badge-active' : (s.status === 'degraded' ? 'badge-degraded' : 'badge-inactive');
            const statusLabel = s.status === 'active' ? 'Actif' : (s.status === 'degraded' ? 'Dégradé' : 'Inactif');
            html += `
              <tr>
                <td><code>${s.id}</code></td>
                <td><strong>${s.name}</strong></td>
                <td><code>${s.type}</code></td>
                <td><code>${s.version}</code></td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>${s.description || 'Aucune description.'}</td>
              </tr>
            `;
          });
          html += `
              </tbody>
            </table>
          `;
        }
      });

      html += `<h2>🔌 Liaisons de Flux et Échanges</h2>`;
      if (currentArchConnections.length === 0) {
        html += `<p><em>Aucune liaison déclarée.</em></p>`;
      } else {
        html += `
          <table>
            <thead>
              <tr>
                <th style="width: 35%;">Service Émetteur</th>
                <th style="width: 10%;"></th>
                <th style="width: 35%;">Service Récepteur</th>
                <th style="width: 20%;">Protocole / Description</th>
              </tr>
            </thead>
            <tbody>
        `;
        currentArchConnections.forEach(c => {
          const srcName = currentArchServices.find(s => s.id === c.from)?.name || c.from;
          const tgtName = currentArchServices.find(s => s.id === c.to)?.name || c.to;
          html += `
            <tr>
              <td><strong>${srcName}</strong> (<code>${c.from}</code>)</td>
              <td style="text-align: center;">➜</td>
              <td><strong>${tgtName}</strong> (<code>${c.to}</code>)</td>
              <td>${c.label ? `<code>${c.label}</code>` : '<em>Non spécifié</em>'}</td>
            </tr>
          `;
        });
        html += `
            </tbody>
          </table>
        `;
      }

      contentWrapper.innerHTML = html;
      tempContainer.appendChild(contentWrapper);
      parentWrapper.appendChild(tempContainer);
      document.body.appendChild(parentWrapper);

      // Yield thread to browser paint cycle
      setTimeout(async () => {
        try {
          const html2pdfLib = await import('html2pdf.js');
          const html2pdf = html2pdfLib.default;
          const opt = {
            margin: 0,
            filename: `architecture_actuelle_${currentArchVersion}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          } as any;

          await html2pdf().from(tempContainer).set(opt).save();
        } catch (pdfErr) {
          console.error("PDF generation library error:", pdfErr);
        } finally {
          document.body.removeChild(parentWrapper);
        }
      }, 150);
    })
    .catch((err) => {
      console.error("Failed to generate PDF:", err);
      alert("Erreur lors de la génération de la cartographie en PDF.");
    });
  };

  const handleExportProjectPdf = async () => {
    if (!activeProject || !structure) return;
    
    const confirmExport = confirm(`Voulez-vous compiler et générer le document PDF complet pour le projet '${activeProject}' (${activeVersion}) ?`);
    if (!confirmExport) return;
    
    try {
      const arc42Files = structure.arc42 || [];
      const arc42Contents = await Promise.all(
        arc42Files.map(async (file) => {
          try {
            const res = await fetch(
              `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&file=${encodeURIComponent(file.path)}&version=${encodeURIComponent(activeVersion)}`,
              { credentials: 'include' }
            );
            if (res.ok) {
              const data = await res.json();
              const text = convertDiagramYamlToMermaid(data.content || '');
              return { name: file.displayName || file.name, text };
            }
          } catch (e) {
            console.error("Failed to fetch section:", file.path, e);
          }
          return { name: file.name, text: `*Erreur de chargement pour la section ${file.name}*` };
        })
      );

      const adrFiles = structure.adrs || [];
      let adrContents: Array<{ name: string, text: string }> = [];
      if (adrFiles.length > 0) {
        adrContents = await Promise.all(
          adrFiles.map(async (file) => {
            try {
              const res = await fetch(
                `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&file=${encodeURIComponent(file.path)}&version=${encodeURIComponent(activeVersion)}`,
                { credentials: 'include' }
              );
              if (res.ok) {
                const data = await res.json();
                const text = convertDiagramYamlToMermaid(data.content || '');
                return { name: file.displayName || file.name, text };
              }
            } catch (e) {
              console.error("Failed to fetch ADR:", file.path, e);
            }
            return { name: file.name, text: `*Erreur de chargement pour l'ADR ${file.name}*` };
          })
        );
      }

      const parentWrapper = document.createElement('div');
      parentWrapper.style.position = 'fixed';
      parentWrapper.style.left = '0';
      parentWrapper.style.top = '0';
      parentWrapper.style.width = '794px';
      parentWrapper.style.height = '100%';
      parentWrapper.style.zIndex = '-9999';
      parentWrapper.style.overflow = 'hidden';
      parentWrapper.style.background = 'transparent';

      const tempContainer = document.createElement('div');
      tempContainer.style.width = '794px';
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.background = '#ffffff';
      tempContainer.style.color = '#000000';
      tempContainer.style.padding = '56px';
      tempContainer.style.fontFamily = 'Arial, Helvetica, sans-serif';

      const styleTag = document.createElement('style');
      styleTag.innerHTML = `
        .pdf-document { font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.2px !important; word-spacing: 1px !important; }
        .pdf-document h1, .pdf-document h2, .pdf-document h3, .pdf-document h4 { line-height: 1.4 !important; letter-spacing: 0.2px !important; word-spacing: 1.5px !important; font-family: Arial, Helvetica, sans-serif !important; }
        .pdf-document p, .pdf-document li, .pdf-document td, .pdf-document th { line-height: 1.5 !important; letter-spacing: 0.1px !important; word-spacing: 1px !important; font-family: Arial, Helvetica, sans-serif !important; }
        .pdf-document h1 { font-size: 24px; margin-bottom: 8px; color: #111827; page-break-before: always; font-weight: bold; }
        .pdf-document h1:first-of-type { page-break-before: avoid; }
        .pdf-document h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; color: #1f2937; font-weight: bold; }
        .pdf-document h3 { font-size: 14px; margin-top: 18px; color: #374151; font-weight: bold; }
        .pdf-document p { font-size: 12px; line-height: 1.6; color: #4b5563; }
        .pdf-document li { font-size: 12px; line-height: 1.6; color: #4b5563; margin-bottom: 4px; }
        .pdf-document ul { margin-top: 6px; margin-bottom: 12px; padding-left: 20px; }
        .pdf-document table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-top: 12px; margin-bottom: 16px; word-break: break-word !important; }
        .pdf-document th, .pdf-document td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 11px; }
        .pdf-document th { background-color: #f9fafb; font-weight: 600; color: #374151; }
        .pdf-document hr { border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        .pdf-document .meta-info { font-size: 11px; color: #6b7280; margin-bottom: 30px; }
      `;
      tempContainer.appendChild(styleTag);

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'pdf-document';

      let html = `
        <h1 style="font-size: 26px; text-align: center; margin-top: 100px; margin-bottom: 10px; line-height: 1.4 !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.5px !important; word-spacing: 3px !important; color: #111827;">Dossier d'Architecture Logicielle</h1>
        <h2 style="font-size: 18px; text-align: center; border: none; margin-bottom: 50px; color: #4b5563; line-height: 1.4 !important; font-weight: normal !important; font-family: Arial, Helvetica, sans-serif !important; letter-spacing: 0.5px !important; word-spacing: 3px !important;">Projet : ${activeProject.toUpperCase()}</h2>
        <div class="meta-info" style="text-align: center; font-size: 12px;">
          <strong>Version de la documentation :</strong> ${activeVersion === 'DRAFT' ? 'DRAFT (Version de travail)' : 'v' + activeVersion}<br/>
          <strong>Date de génération :</strong> ${new Date().toLocaleDateString('fr-FR')}<br/>
          <strong>Générateur :</strong> Archi Portal
        </div>
        <div style="page-break-after: always;"></div>
      `;

      html += `<h1>📖 Modèle de Documentation arc42</h1>`;
      arc42Contents.forEach(section => {
        html += `<h2>📂 ${section.name}</h2>`;
        html += simpleMarkdownToHtml(section.text);
        html += `<hr/>`;
      });

      if (adrContents.length > 0) {
        html += `<h1>⚡ Architecture Decision Records (ADRs)</h1>`;
        adrContents.forEach(adr => {
          html += `<h2>📄 ${adr.name}</h2>`;
          html += simpleMarkdownToHtml(adr.text);
          html += `<hr/>`;
        });
      }

      contentWrapper.innerHTML = html;
      tempContainer.appendChild(contentWrapper);
      parentWrapper.appendChild(tempContainer);
      document.body.appendChild(parentWrapper);

      // Yield thread to browser paint cycle
      setTimeout(async () => {
        try {
          const html2pdfLib = await import('html2pdf.js');
          const html2pdf = html2pdfLib.default;
          const opt = {
            margin: 0,
            filename: `dossier_architecture_${activeProject}_${activeVersion}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 1.5, useCORS: true, logging: false, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          } as any;

          await html2pdf().from(tempContainer).set(opt).save();
        } catch (pdfErr) {
          console.error("PDF generation library error:", pdfErr);
        } finally {
          document.body.removeChild(parentWrapper);
        }
      }, 150);
    } catch (err) {
      console.error("Failed to consolidate project PDF:", err);
      alert("Erreur lors de la génération du dossier PDF.");
    }
  };

  // Load current architecture on mount and when version changes
  useEffect(() => {
    if (user) {
      fetchCurrentArch();
    }
    const handleWsReload = () => {
      fetchCurrentArch();
    };
    window.addEventListener('current-architecture-reload', handleWsReload);
    return () => {
      window.removeEventListener('current-architecture-reload', handleWsReload);
    };
  }, [user, currentArchVersion]);

  // Load saved theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
    } else {
      setTheme('dark');
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
    }
  };

  const handleSaveDoc = async () => {
    if (!activeProject || !activeDoc) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project: activeProject,
          file: activeDoc,
          content: editContent
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setDocContent(editContent);
        setIsEditing(false);
      } else {
        const errData = await res.json();
        alert(`Erreur de sauvegarde: ${errData.detail || 'Erreur inconnue'}`);
      }
    } catch (err: any) {
      alert(`Erreur réseau: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newProjectName }),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh projects list
        const projectsRes = await fetch(`${API_BASE}/api/docs`, { credentials: 'include' });
        const projectsData = await projectsRes.json();
        if (projectsData.projects) {
          setProjects(projectsData.projects);
        }
        
        // Select the newly created project
        setActiveProject(data.project);
        setActiveDoc('');
        
        // Close modal
        setShowCreateModal(false);
        setNewProjectName('');
      } else {
        const errData = await res.json();
        alert(`Erreur de création: ${errData.detail || 'Erreur inconnue'}`);
      }
    } catch (err: any) {
      alert(`Erreur réseau: ${err.message || err}`);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Load dynamic icons mapping on startup
  useEffect(() => {
    async function fetchIcons() {
      try {
        const res = await fetch(`${API_BASE}/api/icons`, { credentials: 'include' });
        const data = await res.json();
        setIconsMap(data);
        const { setDynamicIconsMap } = await import('../components/CustomNodes');
        setDynamicIconsMap(data);
      } catch (err) {
        console.error('Failed to load icons mapping:', err);
      }
    }
    fetchIcons();
  }, []);

  const handleSaveIcons = async (updatedMap: Record<string, string>) => {
    setIsSavingIcons(true);
    try {
      const res = await fetch(`${API_BASE}/api/icons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedMap),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setIconsMap(data);
        const { setDynamicIconsMap } = await import('../components/CustomNodes');
        setDynamicIconsMap(data);
        alert("Configuration des icônes sauvegardée avec succès !");
      } else {
        const errData = await res.json();
        alert(`Erreur de sauvegarde: ${errData.detail || 'Erreur inconnue'}`);
      }
    } catch (err: any) {
      alert(`Erreur réseau: ${err.message || err}`);
    } finally {
      setIsSavingIcons(false);
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = document.getElementById('doc-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newContent = before + textToInsert + after;
    setEditContent(newContent);

    // Focus back on textarea and set cursor position right after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // Extract list of current nodes from yaml block in real-time
  const currentNodesList = useMemo(() => {
    try {
      const match = editContent.match(/```yaml\s*#\s*architecture_description\n([\s\S]*?)```/);
      if (match) {
        const yamlObj = YAML.parse(match[1]);
        if (yamlObj && Array.isArray(yamlObj.nodes)) {
          return yamlObj.nodes.map((n: any) => ({
            id: n.id || '',
            label: n.label || n.id || ''
          })).filter((n: any) => n.id);
        }
      }
    } catch (e) {
      // Ignore syntax errors while typing
    }
    return [];
  }, [editContent]);

  const addNodeToSchema = (label: string, type: string) => {
    if (!label.trim()) return;
    
    const nodeId = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/g, "-")      // Replace non-alphanumeric with dash
      .replace(/-+/g, "-")             // Remove multiple dashes
      .replace(/^-|-$/g, "");          // Trim boundary dashes
      
    const newNode = { id: nodeId, label: label.trim(), type };
    
    const yamlRegex = /(```yaml\s*#\s*architecture_description\n)([\s\S]*?)(```)/;
    const match = editContent.match(yamlRegex);
    
    if (match) {
      try {
        const parsed = YAML.parse(match[2]);
        parsed.nodes = parsed.nodes || [];
        
        if (parsed.nodes.some((n: any) => n.id === nodeId)) {
          alert(`Un composant avec l'identifiant '${nodeId}' existe déjà.`);
          return;
        }
        
        parsed.nodes.push(newNode);
        const updatedYaml = YAML.stringify(parsed);
        const newText = editContent.replace(yamlRegex, `$1${updatedYaml}$3`);
        setEditContent(newText);
        setNodeLabel('');
        setActiveHelperTab('none');
      } catch (err: any) {
        alert("Erreur de modification du schéma YAML : format invalide.");
      }
    } else {
      const newSchemaBlock = `\n\`\`\`yaml\n# architecture_description\nnodes:\n  - id: ${nodeId}\n    label: "${label.trim()}"\n    type: "${type}"\nedges: []\n\`\`\`\n`;
      insertTextAtCursor(newSchemaBlock);
      setNodeLabel('');
      setActiveHelperTab('none');
    }
  };

  const addEdgeToSchema = (source: string, target: string, label: string) => {
    if (!source || !target) return;
    const newEdge = { from: source, to: target, label: label.trim() || undefined };
    
    const yamlRegex = /(```yaml\s*#\s*architecture_description\n)([\s\S]*?)(```)/;
    const match = editContent.match(yamlRegex);
    
    if (match) {
      try {
        const parsed = YAML.parse(match[2]);
        parsed.edges = parsed.edges || [];
        parsed.edges.push(newEdge);
        const updatedYaml = YAML.stringify(parsed);
        const newText = editContent.replace(yamlRegex, `$1${updatedYaml}$3`);
        setEditContent(newText);
        setEdgeLabel('');
        setActiveHelperTab('none');
      } catch (err: any) {
        alert("Erreur de modification du schéma : format YAML invalide.");
      }
    } else {
      alert("Aucun schéma existant dans le document. Veuillez d'abord insérer un schéma ou ajouter un composant.");
    }
  };

  const namespacesList = useMemo(() => {
    const names = currentArchNamespaces.map(n => n.name);
    return ['All', ...names.sort()];
  }, [currentArchNamespaces]);

  const filteredServices = useMemo(() => {
    return currentArchServices.filter(s => {
      const matchNamespace = selectedNamespace === 'All' || s.namespace === selectedNamespace;
      const matchSearch = !searchServiceQuery.trim() || 
        s.name.toLowerCase().includes(searchServiceQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchServiceQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchServiceQuery.toLowerCase()));
      return matchNamespace && matchSearch;
    });
  }, [currentArchServices, selectedNamespace, searchServiceQuery]);

  // Compute grouped types library dynamically from configured icons
  const groupedTypes = useMemo(() => {
    const library: Record<string, { type: string, label: string }[]> = {
      "Générique": [
        { type: "service", label: "Service / API" },
        { type: "database", label: "Base de Données" },
        { type: "browser", label: "Navigateur Client" },
        { type: "server", label: "Serveur Physique" },
        { type: "queue", label: "File d'attente" },
        { type: "cache", label: "Cache mémoire" },
        { type: "folder", label: "Répertoire / Git" },
        { type: "external", label: "Service Externe" },
        { type: "user", label: "Utilisateur" },
        { type: "system", label: "Système global" }
      ],
      "AWS (Amazon Web Services)": [
        { type: "aws-lambda", label: "Lambda Function" },
        { type: "aws-step-functions", label: "Step Functions" },
        { type: "aws-s3", label: "Simple Storage Service (S3)" },
        { type: "aws-dynamodb", label: "DynamoDB NoSQL" },
        { type: "aws-sqs", label: "Simple Queue Service (SQS)" },
        { type: "aws-rds", label: "Relational Database (RDS)" },
        { type: "aws-ecs", label: "Elastic Container Service (ECS)" },
        { type: "aws-eks", label: "Elastic Kubernetes Service (EKS)" },
        { type: "aws-api-gateway", label: "API Gateway" }
      ],
      "Azure (Microsoft Cloud)": [
        { type: "azure-function", label: "Azure Functions" },
        { type: "azure-blob-storage", label: "Blob Storage" },
        { type: "azure-cosmosdb", label: "Cosmos DB" },
        { type: "azure-service-bus", label: "Service Bus" },
        { type: "azure-app-service", label: "App Service Web App" },
        { type: "azure-sql", label: "Azure SQL Database" }
      ],
      "Kubernetes (K8s)": [
        { type: "k8s-pod", label: "Pod Container" },
        { type: "k8s-deployment", label: "Deployment Controller" },
        { type: "k8s-service", label: "Service Endpoint" },
        { type: "k8s-ingress", label: "Ingress Router" },
        { type: "k8s-job", label: "Job Runner" },
        { type: "k8s-configmap", label: "ConfigMap Store" },
        { type: "k8s-secret", label: "Secret Store" }
      ]
    };

    const predefinedKeys = new Set(Object.values(library).flatMap(list => list.map(item => item.type)));
    const customList: { type: string, label: string }[] = [];
    
    Object.keys(iconsMap).forEach(key => {
      if (!predefinedKeys.has(key)) {
        customList.push({ type: key, label: key.toUpperCase() });
      }
    });

    if (customList.length > 0) {
      library["Personnalisé"] = customList;
    }

    return library;
  }, [iconsMap]);

  // 1. Verify User Session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to verify authentication:', err);
        setUser(null);
      } finally {
        setLoadingAuth(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch available projects (and support search debounce)
  useEffect(() => {
    if (!user) return;
    
    async function loadProjects() {
      try {
        const url = `${API_BASE}/api/docs${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`;
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (data.projects) {
          setProjects(data.projects);
        }
      } catch (err) {
        console.error('Failed to load projects list:', err);
      }
    }

    const timer = setTimeout(loadProjects, 250);
    return () => clearTimeout(timer);
  }, [user, searchQuery]);

  // Sort projects based on selected sort criteria and relevance score
  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    
    const filtered = projects.filter(p => {
      if (adminMode) {
        return true;
      } else {
        return p.name !== 'project_example';
      }
    });

    return filtered.sort((a, b) => {
      // If doing search, we can optionally sort by search score first (relevance)
      if (searchQuery && a.search_score !== undefined && b.search_score !== undefined) {
        if (b.search_score !== a.search_score) {
          return b.search_score - a.search_score;
        }
      }
      
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a.last_updated - b.last_updated;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [projects, sortBy, sortOrder, searchQuery, adminMode]);

  // 3. Fetch project structure (arc42 files + adrs) when activeProject or activeVersion changes
  useEffect(() => {
    if (!activeProject) {
      setStructure(null);
      return;
    }

    async function loadStructure() {
      try {
        const res = await fetch(
          `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&version=${encodeURIComponent(activeVersion)}`,
          { credentials: 'include' }
        );
        const data: ProjectStructure & { versions?: string[] } = await res.json();
        setStructure(data);
        setProjectVersions(data.versions || ['DRAFT']);

        // Select the first arc42 file by default if structure changes and activeDoc is no longer valid
        if (data.arc42 && data.arc42.length > 0) {
          const allDocs = [...data.arc42, ...(data.adrs || [])];
          if (!allDocs.some(d => d.path === activeDoc)) {
            setActiveDoc(data.arc42[0].path);
          }
        } else if (data.adrs && data.adrs.length > 0) {
          const allDocs = [...data.arc42, ...(data.adrs || [])];
          if (!allDocs.some(d => d.path === activeDoc)) {
            setActiveDoc(data.adrs[0].path);
          }
        } else {
          setActiveDoc('');
          setDocContent('');
        }
      } catch (err) {
        console.error('Failed to load project structure:', err);
      }
    }
    loadStructure();
  }, [activeProject, activeVersion, user]);

  // 4. Fetch file content when activeDoc, activeProject or activeVersion changes
  useEffect(() => {
    if (!activeProject || !activeDoc || !user) return;

    async function loadDocContent() {
      try {
        const res = await fetch(
          `${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}&file=${encodeURIComponent(activeDoc)}&version=${encodeURIComponent(activeVersion)}`,
          { credentials: 'include' }
        );
        const data = await res.json();
        setDocContent(data.content || '');
        setEditContent(data.content || '');
        setIsEditing(false); // Cancel edit mode when changing documents
      } catch (err) {
        console.error('Failed to load document content:', err);
      }
    }
    loadDocContent();
  }, [activeProject, activeDoc, activeVersion, user]);

  // 5. WebSocket setup for Live Reload
  const handleLiveFileChange = useCallback((project: string, filePath: string, newContent: string) => {
    if (project === activeProject) {
      if (filePath === activeDoc && !isEditing) {
        setDocContent(newContent);
      }
      
      // If it's a structural file change (e.g. new ADR file added), refresh structure list
      if (filePath.includes('adrs/') || filePath.includes('arc42/')) {
        fetch(`${API_BASE}/api/docs?project=${encodeURIComponent(activeProject)}`, { credentials: 'include' })
          .then(res => res.json())
          .then((data: ProjectStructure) => setStructure(data))
          .catch(e => console.error('Failed to refresh structure:', e));
      }
    }
  }, [activeProject, activeDoc]);

  const wsConnected = useWebSocket('ws://localhost:8000/ws', handleLiveFileChange);

  // 6. In-portal navigation helper
  const handleDocNavigation = useCallback((href: string) => {
    const adrMatch = href.match(/adrs\/([^\s\)]+)/);
    if (adrMatch) {
      setActiveDoc(`adrs/${adrMatch[1]}`);
      return;
    }

    const arcMatch = href.match(/arc42\/([^\s\)]+)/);
    if (arcMatch) {
      setActiveDoc(`arc42/${arcMatch[1]}`);
      return;
    }

    const cleanPath = href.replace(/^\.\.\//, '');
    setActiveDoc(cleanPath);
  }, []);

  // 7. Extract nodes/edges for the split screen view
  const activeDiagram = useMemo(() => {
    const contentToParse = isEditing ? editContent : docContent;
    if (!contentToParse) return null;
    
    const regex = /```(?:yaml|json)[\s\S]*?(nodes:[\s\S]*?edges:[\s\S]*?)```/g;
    const match = regex.exec(contentToParse);
    if (match) {
      try {
        const parsed = YAML.parse(match[1]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          return {
            nodes: parsed.nodes,
            edges: parsed.edges || []
          };
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [docContent, editContent, isEditing]);

  // Determine section index if activeDoc is an arc42 section
  const activeSectionNumber = useMemo(() => {
    if (!activeDoc.startsWith('arc42/')) return null;
    const parts = activeDoc.split('/');
    if (parts.length < 2) return null;
    const num = parseInt(parts[1].split('_')[0], 10);
    return isNaN(num) ? null : num;
  }, [activeDoc]);

  // Render Loading Screen
  if (loadingAuth) {
    return (
      <div className="dashboard-panel" style={{ height: '100vh', width: '100vw' }}>
        <div className="dashboard-content">
          <BookMarked size={48} style={{ color: 'var(--accent-glow)', animation: 'pulse 1.5s infinite' }} />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Vérification de session...</p>
        </div>
      </div>
    );
  }

  // Render Login Screen (if not logged in)
  if (!user) {
    return (
      <div className="dashboard-panel" style={{ height: '100vh', width: '100vw', position: 'relative' }}>
        {/* Floating Theme Switcher on Login Screen */}
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <button
            className="split-toggle-btn"
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? "Mode Clair" : "Mode Sombre"}</span>
          </button>
        </div>

        <div className="dashboard-content" style={{ maxWidth: 420, padding: 40, background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
          <BookMarked size={64} style={{ color: 'var(--accent-glow)', marginBottom: 24 }} />
          <h2 className="dashboard-title" style={{ fontSize: '1.5rem', marginBottom: 12 }}>Archi Portal</h2>
          <p className="dashboard-desc" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
            Référentiel d'architecture basé sur arc42 & ADR. Connectez-vous avec vos identifiants d'entreprise pour accéder à la documentation.
          </p>
          <a
            href={`${API_BASE}/api/auth/login`}
            className="split-toggle-btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              width: '100%', 
              padding: '12px 24px', 
              background: 'var(--accent-glow)', 
              color: '#fff',
              border: 'none',
              fontWeight: 600
            }}
          >
            <LogIn size={18} />
            Se connecter avec Azure Entra ID
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 64,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        zIndex: 20
      }}>
        {/* Left Side: Logo & Title */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => {
            setCurrentView('projects');
            setActiveProject('');
            setActiveDoc('');
          }}
        >
          <BookMarked size={22} style={{ color: 'var(--accent-glow)' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--heading-color)', letterSpacing: '-0.3px' }}>Archi Portal</span>
        </div>

        {/* Center: Main View Toggle Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setCurrentView('projects')}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: currentView === 'projects' ? 'var(--accent-glow)' : 'transparent',
              color: currentView === 'projects' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease'
            }}
          >
            <BookOpen size={14} />
            Architecture des Projets
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentView('current_architecture');
              setActiveDoc('');
            }}
            style={{
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: currentView === 'current_architecture' ? 'var(--accent-glow)' : 'transparent',
              color: currentView === 'current_architecture' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease'
            }}
          >
            <Network size={14} />
            Architecture Actuelle
          </button>
        </div>

        {/* Right Side: User Profile & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {user.roles && user.roles.some(r => r.toLowerCase().includes('admin')) && (
                <>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-service)', background: 'rgba(139, 92, 246, 0.1)', padding: '1px 5px', borderRadius: 4 }}>
                    ADMIN
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={adminMode}
                      onChange={(e) => {
                        setAdminMode(e.target.checked);
                        setActiveProject('');
                        setActiveDoc('');
                      }}
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                    Template
                  </label>
                </>
              )}
              {user.roles && user.roles.includes('Architects') && !user.roles.some(r => r.toLowerCase().includes('admin')) && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                  ARCHITECTE
                </span>
              )}
            </div>
          </div>

          <div style={{ height: 20, width: 1, background: 'var(--border-color)' }} />

          {/* Theme switcher */}
          <button
            className="split-toggle-btn"
            onClick={toggleTheme}
            style={{ padding: 6, height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Changer de thème"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Logout */}
          <a
            href={`${API_BASE}/api/auth/logout`}
            className="split-toggle-btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: 32, 
              width: 32, 
              borderColor: 'rgba(239, 68, 68, 0.2)', 
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.02)',
              cursor: 'pointer'
            }}
            title="Se déconnecter"
          >
            <LogOut size={14} />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-container" style={{ flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {currentView === 'projects' ? (
          <>
            {/* Sidebar Panel */}
            <aside className="sidebar">
              <div 
                className="sidebar-header" 
                style={{ paddingBottom: 16, cursor: 'pointer' }}
                onClick={() => {
                  setActiveProject('');
                  setActiveDoc('');
                }}
              >
                <h1 className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookMarked size={20} style={{ color: 'var(--accent-glow)' }} />
                  Architecture des Projets
                </h1>
              </div>

              {/* Project Selector */}
              <div className="project-selector-wrapper" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <label className="nav-section-title" style={{ paddingLeft: 0, display: 'block', marginBottom: 6 }}>
                  Référentiel Projet
                </label>
                <select
                  className="project-select"
                  value={activeProject}
                  onChange={(e) => {
                    setActiveProject(e.target.value);
                    setActiveDoc('');
                  }}
                >
                  <option value="">-- Accueil / Projets --</option>
                  {projects
                    .filter(p => adminMode || p.name !== 'project_example')
                    .map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name === 'project_example' ? "📁 Modèle / Template" : p.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Project Version Selector (only if a project is active) */}
              {activeProject && (
                <div className="project-selector-wrapper" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="nav-section-title" style={{ paddingLeft: 0, margin: 0 }}>
                      Version de la documentation
                    </label>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 700, 
                      color: activeVersion === 'DRAFT' ? '#f59e0b' : '#10b981',
                      background: activeVersion === 'DRAFT' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: activeVersion === 'DRAFT' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(16,185,129,0.2)'
                    }}>
                      {activeVersion === 'DRAFT' ? "DRAFT (Édition)" : "FIGÉE (Lecture seule)"}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="project-select"
                      value={activeVersion}
                      onChange={(e) => {
                        setActiveVersion(e.target.value);
                      }}
                      style={{ flex: 1 }}
                    >
                      {projectVersions.map((v) => (
                        <option key={v} value={v}>
                          {v === 'DRAFT' ? "📝 Version de travail (DRAFT)" : `🔒 Version ${v}`}
                        </option>
                      ))}
                    </select>

                    {/* Manual freeze version button */}
                    {activeVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleCreateNewVersion}
                        disabled={isFreezingVersion}
                        style={{ padding: '0 12px', fontSize: '0.75rem', height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Figer la version actuelle (DRAFT)"
                      >
                        {isFreezingVersion ? "..." : "Figer"}
                      </button>
                    )}
                  </div>
                  
                  {/* Project Export Panel */}
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Documentation
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="split-toggle-btn"
                        onClick={handleExportProjectMarkdown}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '0.7rem', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', borderRadius: 6 }}
                        title="Exporter toute la documentation (12 sections + ADRs) en un seul fichier Markdown"
                      >
                        <span>📥 Markdown</span>
                      </button>
                      <button
                        type="button"
                        className="split-toggle-btn"
                        onClick={handleExportProjectPdf}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '0.7rem', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', borderRadius: 6 }}
                        title="Exporter toute la documentation (12 sections + ADRs) en un seul fichier PDF"
                      >
                        <span>🖨️ PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation lists */}
              <nav className="sidebar-nav">
                {activeProject && structure && structure.arc42 ? (
                  <>
                    {/* ARC42 NAV SECTION */}
                    <div className="nav-section">
                      <h3 className="nav-section-title">Structure arc42 (iSAQB)</h3>
                      <ul className="nav-list">
                        {structure.arc42.map((doc) => {
                          const isActive = activeDoc === doc.path;
                          return (
                            <li key={doc.path}>
                              <button
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => setActiveDoc(doc.path)}
                              >
                                <BookOpen size={16} className="nav-item-icon" />
                                <span>{doc.displayName}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* ADR NAV SECTION */}
                    {structure.adrs && structure.adrs.length > 0 && (
                      <div className="nav-section" style={{ marginTop: 24 }}>
                        <h3 className="nav-section-title">Architecture Decision Records</h3>
                        <ul className="nav-list">
                          {structure.adrs.map((doc) => {
                            const isActive = activeDoc === doc.path;
                            return (
                              <li key={doc.path}>
                                <button
                                  className={`nav-item ${isActive ? 'active' : ''}`}
                                  onClick={() => setActiveDoc(doc.path)}
                                >
                                  <FileCode size={16} className="nav-item-icon" />
                                  <span>{doc.displayName}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="nav-item-empty" style={{ fontSize: '0.85rem' }}>
                    Veuillez sélectionner un projet pour afficher sa structure documentaire.
                  </div>
                )}
              </nav>
            </aside>

            {/* Document display viewport */}
            {activeDoc ? (
              <div className="workspace-content">
                {/* Horizontal Timeline Panel */}
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  borderBottom: '1px solid var(--border-color)', 
                  padding: '16px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 8,
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Frise Chronologique des Versions
                    </span>
                    {activeVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleCreateNewVersion}
                        disabled={isFreezingVersion}
                        style={{ padding: '4px 12px', fontSize: '0.75rem', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isFreezingVersion ? "Figeage..." : "💾 Figer l'état actuel"}
                      </button>
                    )}
                  </div>
                  
                  {/* Timeline Scrollable Track */}
                  <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                    <div style={{ 
                      position: 'relative', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px 40px',
                      marginTop: 4,
                      minWidth: 400,
                      gap: 20
                    }}>
                      {/* Horizontal track line */}
                      <div style={{ 
                        position: 'absolute', 
                        left: 40, 
                        right: 40, 
                        height: 2, 
                        background: 'var(--border-color)', 
                        zIndex: 1 
                      }} />
                      
                      {/* Timeline Items sorted oldest to newest */}
                      {[...projectVersions].reverse().map((v) => {
                        const isActive = activeVersion === v;
                        const isDraft = v === 'DRAFT';
                        
                        return (
                          <div 
                            key={v} 
                            onClick={() => setActiveVersion(v)}
                            style={{ 
                              position: 'relative', 
                              zIndex: 2, 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              cursor: 'pointer',
                              flex: 1
                            }}
                          >
                            {/* Circle dot node */}
                            <div style={{ 
                              width: 14, 
                              height: 14, 
                              borderRadius: '50%', 
                              background: isActive 
                                ? (isDraft ? '#f59e0b' : 'var(--accent-glow)') 
                                : 'var(--bg-secondary)', 
                              border: isActive 
                                ? `3px solid ${isDraft ? '#f59e0b' : 'var(--accent-glow)'}` 
                                : '2px solid var(--border-color)',
                              boxShadow: isActive 
                                ? `0 0 10px ${isDraft ? 'rgba(245,158,11,0.6)' : 'rgba(0,180,216,0.6)'}` 
                                : 'none',
                              transition: 'all 0.2s ease',
                            }} 
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.borderColor = 'var(--text-secondary)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                            />
                            
                            {/* Version Label */}
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: isActive ? 700 : 500, 
                              color: isActive ? 'var(--heading-color)' : 'var(--text-muted)', 
                              marginTop: 8,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              padding: '2px 6px',
                              borderRadius: 4
                            }}>
                              {isDraft ? "📝 DRAFT" : `v${v}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <header className="workspace-header">
                  <div className="workspace-title-area">
                    <span className="active-doc-title">
                      {activeDoc.startsWith('arc42/') 
                        ? `arc42 Section ${activeSectionNumber}` 
                        : 'Architecture Decision Record'}
                    </span>
                    <span className="active-doc-subtitle">
                      Fichier: {activeDoc}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* Edit Button */}
                    {activeVersion === 'DRAFT' ? (
                      <button
                        className={`split-toggle-btn ${isEditing ? 'active' : ''}`}
                        onClick={() => {
                          if (isEditing) {
                            // Cancel changes: reload saved content
                            setEditContent(docContent);
                          }
                          setIsEditing(!isEditing);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                      >
                        <Edit3 size={15} />
                        <span>{isEditing ? "Annuler" : "Éditer"}</span>
                      </button>
                    ) : (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        padding: '6px 12px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 6, 
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.01)'
                      }}>
                        🔒 Lecture seule
                      </div>
                    )}

                    {/* Split View toggle */}
                    <button
                      className={`split-toggle-btn ${splitScreen ? 'active' : ''}`}
                      onClick={() => setSplitScreen(!splitScreen)}
                      style={{ cursor: 'pointer' }}
                    >
                      Double Écran
                    </button>
                    
                    {/* Help toggle */}
                    {activeDoc.startsWith('arc42/') && (
                      <button
                        className={`split-toggle-btn ${showHelp ? 'active' : ''}`}
                        onClick={() => setShowHelp(!showHelp)}
                        style={{ cursor: 'pointer' }}
                      >
                        Aide iSAQB
                      </button>
                    )}
                  </div>
                </header>

                <div className="workspace-body">
                  {/* Left Side: Markdown Content (Reader or Text Editor) */}
                  <div className="markdown-panel" style={{ width: splitScreen ? '50%' : '100%', borderRight: splitScreen ? '1px solid var(--border-color)' : 'none' }}>
                    {isEditing ? (
                      <div className="editor-container">
                        <div className="editor-toolbar">
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fichier ouvert en écriture</span>
                          <button
                            className="btn-primary"
                            onClick={handleSaveDoc}
                            disabled={isSaving}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            <Save size={14} />
                            <span>{isSaving ? "Enregistrement..." : "Sauvegarder"}</span>
                          </button>
                        </div>

                        {/* Methodology alert when editing reference template */}
                        {activeProject === 'project_example' && (
                          <div className="methodology-guide" style={{ margin: '12px 16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <p className="methodology-text" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-service)' }}>
                              ⚠️ ATTENTION : Vous éditez actuellement le modèle de référence globale (Template). Toutes les modifications impacteront les nouveaux projets générés.
                            </p>
                          </div>
                        )}

                        {/* Markdown & Schema formatting bar */}
                        <div style={{ 
                          display: 'flex', 
                          gap: 8, 
                          padding: '8px 12px', 
                          background: 'var(--bg-secondary)', 
                          borderBottom: '1px solid var(--border-color)', 
                          borderTop: '1px solid var(--border-color)',
                          flexWrap: 'wrap',
                          alignItems: 'center'
                        }}>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('\n```yaml\n# architecture_description\nnodes:\n  - id: client\n    label: "Navigateur Client"\n    type: "browser"\n  - id: gateway\n    label: "API Gateway"\n    type: "gateway"\n  - id: service\n    label: "Service Core"\n    type: "service"\n  - id: db\n    label: "Base de Données"\n    type: "database"\nedges:\n  - from: client\n    to: gateway\n    label: "Requêtes HTTPS"\n  - from: gateway\n    to: service\n    label: "Proxying gRPC"\n  - from: service\n    to: db\n    label: "SQL Read/Write"\n```\n')}
                            title="Insérer un schéma d'architecture"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(139, 92, 246, 0.05)', color: 'var(--color-service)', borderColor: 'rgba(139, 92, 246, 0.2)', padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <LayoutGrid size={13} />
                            <span>➕ Insérer Schéma</span>
                          </button>

                          <div style={{ height: 18, width: 1, background: 'var(--border-color)', margin: '0 4px' }} />

                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('**')}
                            title="Gras"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            G
                          </button>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('*')}
                            title="Italique"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', fontStyle: 'italic', cursor: 'pointer' }}
                          >
                            I
                          </button>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('## ')}
                            title="Titre H2"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            H2
                          </button>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('- ')}
                            title="Liste à puces"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Bullet
                          </button>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('[texte](url)')}
                            title="Lien hypertexte"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Lien
                          </button>
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('\n| Colonne 1 | Colonne 2 |\n| --------- | --------- |\n| Valeur 1  | Valeur 2  |\n')}
                            title="Tableau Markdown"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Tableau
                          </button>

                          <div style={{ height: 18, width: 1, background: 'var(--border-color)', margin: '0 4px' }} />

                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => insertTextAtCursor('[ADR-XXXX](adr-xxxx.md)')}
                            title="Lien de référence vers une ADR"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--accent-glow)', color: 'var(--accent-glow)', cursor: 'pointer' }}
                          >
                            Réf ADR
                          </button>
                        </div>

                        {/* Collapsible Schema Helpers */}
                        <div style={{ 
                          display: 'flex', 
                          gap: 12, 
                          padding: '8px 12px', 
                          background: 'rgba(255, 255, 255, 0.01)', 
                          borderBottom: '1px solid var(--border-color)',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Assistant de Schéma :</span>
                          
                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => setActiveHelperTab(activeHelperTab === 'node' ? 'none' : 'node')}
                            style={activeHelperTab === 'node' ? { background: 'var(--accent-glow)', color: '#fff', cursor: 'pointer' } : { cursor: 'pointer' }}
                          >
                            ➕ Ajouter un Composant
                          </button>

                          <button
                            type="button"
                            className="split-toggle-btn"
                            onClick={() => {
                              if (currentNodesList.length === 0) {
                                alert("Veuillez d'abord ajouter des composants au schéma avant d'établir des liaisons.");
                                return;
                              }
                              if (currentNodesList.length >= 1) {
                                setEdgeSource(currentNodesList[0].id);
                                setEdgeTarget(currentNodesList[currentNodesList.length - 1].id);
                              }
                              setActiveHelperTab(activeHelperTab === 'edge' ? 'none' : 'edge');
                            }}
                            style={activeHelperTab === 'edge' ? { background: 'var(--accent-glow)', color: '#fff', cursor: 'pointer' } : { cursor: 'pointer' }}
                          >
                            🔗 Ajouter une Liaison
                          </button>
                        </div>

                        {/* Helper drawers */}
                        {activeHelperTab === 'node' && (
                          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Nom du Composant</label>
                              <input
                                type="text"
                                className="search-input-field"
                                placeholder="Ex: API Paiement"
                                value={nodeLabel}
                                onChange={(e) => setNodeLabel(e.target.value)}
                                style={{ height: 38, background: 'var(--bg-primary)' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Type / Icône</label>
                              <select
                                className="project-select"
                                value={nodeType}
                                onChange={(e) => setNodeType(e.target.value)}
                                style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                              >
                                {Object.entries(groupedTypes).map(([groupName, items]) => (
                                  <optgroup key={groupName} label={groupName}>
                                    {items.map((item) => (
                                      <option key={item.type} value={item.type}>
                                        {item.label} ({item.type})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => addNodeToSchema(nodeLabel, nodeType)}
                              disabled={!nodeLabel.trim()}
                              style={{ height: 38, padding: '0 16px', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              Ajouter au schéma
                            </button>
                          </div>
                        )}

                        {activeHelperTab === 'edge' && (
                          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Source</label>
                              <select
                                className="project-select"
                                value={edgeSource}
                                onChange={(e) => setEdgeSource(e.target.value)}
                                style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                              >
                                {currentNodesList.map((n: any) => (
                                  <option key={n.id} value={n.id}>
                                    {n.label} ({n.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Cible</label>
                              <select
                                className="project-select"
                                value={edgeTarget}
                                onChange={(e) => setEdgeTarget(e.target.value)}
                                style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                              >
                                {currentNodesList.map((n: any) => (
                                  <option key={n.id} value={n.id}>
                                    {n.label} ({n.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1.5, minWidth: 160 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Description du lien (Optionnel)</label>
                              <input
                                type="text"
                                className="search-input-field"
                                placeholder="Ex: REST API"
                                value={edgeLabel}
                                onChange={(e) => setEdgeLabel(e.target.value)}
                                style={{ height: 38, background: 'var(--bg-primary)' }}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => addEdgeToSchema(edgeSource, edgeTarget, edgeLabel)}
                              disabled={!edgeSource || !edgeTarget}
                              style={{ height: 38, padding: '0 16px', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              Connecter
                            </button>
                          </div>
                        )}

                        <textarea
                          id="doc-editor-textarea"
                          className="editor-textarea"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Saisissez votre documentation au format Markdown..."
                        />
                      </div>
                    ) : (
                      <>
                        {/* Help block (iSAQB) */}
                        {activeDoc.startsWith('arc42/') && showHelp && activeSectionNumber !== null && (
                          <div className="methodology-guide" style={{ margin: '20px 24px 0 24px' }}>
                            <h4 className="methodology-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--accent-glow)' }}>
                              <Info size={14} />
                              Guide méthodologique iSAQB — Section {activeSectionNumber}
                            </h4>
                            <p className="methodology-text" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                              {isaqbHelpMap[activeSectionNumber]}
                            </p>
                          </div>
                        )}

                        <MarkdownRenderer 
                          content={docContent} 
                          onNavigate={handleDocNavigation} 
                        />
                      </>
                    )}
                  </div>

                  {/* Right Side: Diagram Viewer (Only in split-screen mode) */}
                  {splitScreen && (
                    <div className="diagram-panel">
                      {activeDiagram ? (
                        <DiagramRenderer 
                          initialNodes={activeDiagram.nodes} 
                          initialEdges={activeDiagram.edges} 
                          isEditing={isEditing}
                          onAddNode={addNodeToSchema}
                          onAddEdge={addEdgeToSchema}
                          groupedTypes={groupedTypes}
                        />
                      ) : (
                        <div className="dashboard-panel">
                          <div className="dashboard-content">
                            <LayoutGrid size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                            <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: 8 }}>Aucun schéma d'architecture détecté</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              Le document actif ne contient pas de bloc de schéma YAML de type `type=architecture-diagram`.
                              Ajoutez un bloc de code YAML dans le Markdown pour le voir s'afficher ici.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="document-panel" style={{ overflowY: 'auto', padding: '40px 60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, gap: 20 }}>
                  <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 12, color: 'var(--heading-color)' }}>
                      Référentiel d'Architecture
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      Explorez et gérez la documentation technique arc42, les schémas d'architecture et les fiches ADR de tous vos projets.
                    </p>
                  </div>
                  {user && user.roles.some(r => r.toLowerCase().includes('architect')) && (
                    <button
                      className="btn-primary"
                      onClick={() => setShowCreateModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: '0.9rem', flexShrink: 0 }}
                    >
                      <Plus size={16} />
                      Nouveau Projet
                    </button>
                  )}
                </div>

                {/* Search and Filters Bar */}
                <div className="search-filter-bar">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      className="search-input-field"
                      placeholder="Recherche intelligente dans les titres, en-têtes et contenus..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="sort-select-wrapper">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trier par :</span>
                    <select
                      className="sort-select-field"
                      value={sortBy}
                      onChange={(e) => {
                        const newSortBy = e.target.value as 'name' | 'date';
                        setSortBy(newSortBy);
                        setSortOrder(newSortBy === 'name' ? 'asc' : 'desc');
                      }}
                    >
                      <option value="date">Date de mise à jour</option>
                      <option value="name">Nom du projet</option>
                    </select>

                    <button
                      className="split-toggle-btn"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px' }}
                      title={sortOrder === 'asc' ? "Ordre Croissant" : "Ordre Décroissant"}
                    >
                      <ArrowUpDown size={15} style={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                    </button>
                  </div>
                </div>

                {/* Projects Grid Mosaic */}
                {sortedProjects.length === 0 ? (
                  <div className="dashboard-panel" style={{ padding: '60px 0' }}>
                    <div className="dashboard-content">
                      <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: 8 }}>Aucun projet trouvé</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Aucun projet ne correspond à vos critères de recherche.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="project-grid">
                    {sortedProjects.map((p) => {
                      const updateDate = p.last_updated
                        ? new Date(p.last_updated).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'Date inconnue';
                      return (
                        <div
                          key={p.name}
                          className={`project-card ${p.name === 'project_example' ? 'template-card' : ''}`}
                          onClick={() => {
                            setActiveProject(p.name);
                          }}
                          style={p.name === 'project_example' ? { borderColor: 'var(--color-service)', boxShadow: '0 4px 20px rgba(139, 92, 246, 0.15)' } : {}}
                        >
                          <div>
                            <div className="project-card-header">
                              <h3 className="project-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {p.name === 'project_example' ? "📁 Modèle de projet" : p.name}
                              </h3>
                              {p.name === 'project_example' ? (
                                <span className="badge" style={{ borderColor: 'var(--color-service)', color: 'var(--color-service)', background: 'rgba(139, 92, 246, 0.05)' }}>
                                  TEMPLATE
                                </span>
                              ) : (
                                searchQuery && p.search_score !== undefined && (
                                  <span className="badge" style={{ borderColor: 'var(--accent-glow)', color: 'var(--accent-glow)' }}>
                                    Score: {p.search_score}
                                  </span>
                                )
                              )}
                            </div>
                            <p className="project-card-desc">{p.description}</p>
                          </div>
                          
                          <div className="project-card-footer">
                            <div className="project-card-stats">
                              <span className="badge">{p.section_count} sections</span>
                              <span className="badge badge-adr">{p.adr_count} ADRs</span>
                            </div>
                            <span className="project-card-date">MàJ: {updateDate}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* CURRENT ARCHITECTURE VIEW SIDEBAR */}
            <aside className="sidebar">
              <div className="sidebar-header" style={{ paddingBottom: 16 }}>
                <h1 className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Network size={20} style={{ color: 'var(--accent-glow)' }} />
                  Architecture Actuelle
                </h1>
              </div>

              {/* Search Services input */}
              <div className="project-selector-wrapper" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <label className="nav-section-title" style={{ paddingLeft: 0, display: 'block', marginBottom: 6 }}>
                  Rechercher un Service
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder="Nom, ID, description..."
                    value={searchServiceQuery}
                    onChange={(e) => setSearchServiceQuery(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: '0.8rem', height: 36, width: '100%', background: 'var(--bg-primary)' }}
                  />
                </div>
              </div>

              {/* Namespaces navigation lists */}
              <nav className="sidebar-nav" style={{ padding: '16px 0' }}>
                <div className="nav-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 className="nav-section-title" style={{ margin: 0 }}>Groupes / Namespaces</h3>
                    {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                      <button
                        type="button"
                        className="split-toggle-btn"
                        onClick={() => {
                          setNamespaceName('');
                          setNamespaceDescription('');
                          setShowNamespaceModal(true);
                        }}
                        style={{ padding: '2px 6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                        title="Ajouter un namespace"
                      >
                        <Plus size={12} />
                        <span>Nouveau</span>
                      </button>
                    )}
                  </div>
                  <ul className="nav-list">
                    {namespacesList.map((ns) => {
                      const count = ns === 'All' 
                        ? currentArchServices.length 
                        : currentArchServices.filter(s => s.namespace === ns).length;
                      
                      const isActive = selectedNamespace === ns;
                      return (
                        <li key={ns} className="namespace-sidebar-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <button
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setSelectedNamespace(ns)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', flex: 1 }}>
                              <Folder size={15} className="nav-item-icon" style={{ flexShrink: 0 }} />
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {ns === 'All' ? "Tous les Services" : ns}
                              </span>
                              {currentArchNamespaces.find(n => n.name === ns)?.isSystem && (
                                <span 
                                  style={{ 
                                    fontSize: '0.55rem', 
                                    background: 'rgba(139, 92, 246, 0.08)', 
                                    color: 'var(--accent-glow)', 
                                    border: '1px solid rgba(139, 92, 246, 0.2)', 
                                    borderRadius: 4, 
                                    padding: '1px 4px', 
                                    fontWeight: 700, 
                                    flexShrink: 0,
                                    lineHeight: 1
                                  }}
                                  title="Namespace Système / Infrastructure"
                                >
                                  SYS
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 10, flexShrink: 0 }}>
                              {count}
                            </span>
                          </button>
                          
                          {currentArchVersion === 'DRAFT' && ns !== 'All' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              {/* System Status Gear Toggle */}
                              <button
                                type="button"
                                className="split-toggle-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleNamespaceSystem(ns);
                                }}
                                style={{ 
                                  padding: '6px', 
                                  border: 'none', 
                                  background: 'transparent',
                                  color: currentArchNamespaces.find(n => n.name === ns)?.isSystem ? 'var(--accent-glow)' : 'var(--text-muted)', 
                                  opacity: currentArchNamespaces.find(n => n.name === ns)?.isSystem ? 1 : 0.4,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Basculer le statut Système (⚙️)"
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { 
                                  const nsIsSys = currentArchNamespaces.find(n => n.name === ns)?.isSystem;
                                  e.currentTarget.style.opacity = nsIsSys ? '1' : '0.4'; 
                                }}
                              >
                                <Settings size={12} />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                className="split-toggle-btn namespace-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNamespace(ns);
                                }}
                                style={{ 
                                  padding: '6px', 
                                  border: 'none', 
                                  background: 'transparent',
                                  color: '#ef4444', 
                                  opacity: 0.4,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title={`Supprimer le namespace ${ns}`}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </nav>
            </aside>

            {/* CURRENT ARCHITECTURE VIEW MAIN CONTAINER */}
            <main className="workspace" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Architecture Actuelle Horizontal Timeline Panel */}
              <div style={{ 
                background: 'var(--bg-secondary)', 
                borderBottom: '1px solid var(--border-color)', 
                padding: '16px 40px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 8,
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Versions de l'Architecture Globale (Cartographie)
                  </span>
                  {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCreateNewCurrentArchVersion}
                      disabled={isFreezingCurrentArch}
                      style={{ padding: '4px 12px', fontSize: '0.75rem', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isFreezingCurrentArch ? "Figeage..." : "💾 Figer l'architecture globale"}
                    </button>
                  )}
                </div>
                
                {/* Timeline Scrollable Track */}
                <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                  <div style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 40px',
                    marginTop: 4,
                    minWidth: 400,
                    gap: 20
                  }}>
                    {/* Horizontal track line */}
                    <div style={{ 
                      position: 'absolute', 
                      left: 40, 
                      right: 40, 
                      height: 2, 
                      background: 'var(--border-color)', 
                      zIndex: 1 
                    }} />
                    
                    {/* Timeline Items sorted oldest to newest */}
                    {[...currentArchVersionsList].reverse().map((v) => {
                      const isActive = currentArchVersion === v;
                      const isDraft = v === 'DRAFT';
                      
                      return (
                        <div 
                          key={v} 
                          onClick={() => setCurrentArchVersion(v)}
                          style={{ 
                            position: 'relative', 
                            zIndex: 2, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          {/* Circle dot node */}
                          <div style={{ 
                            width: 14, 
                            height: 14, 
                            borderRadius: '50%', 
                            background: isActive 
                              ? (isDraft ? '#f59e0b' : 'var(--accent-glow)') 
                              : 'var(--bg-secondary)', 
                            border: isActive 
                              ? `3px solid ${isDraft ? '#f59e0b' : 'var(--accent-glow)'}` 
                              : '2px solid var(--border-color)',
                            boxShadow: isActive 
                              ? `0 0 10px ${isDraft ? 'rgba(245,158,11,0.6)' : 'rgba(0,180,216,0.6)'}` 
                              : 'none',
                            transition: 'all 0.2s ease',
                          }} 
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.borderColor = 'var(--text-secondary)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.borderColor = 'var(--border-color)';
                          }}
                          />
                          
                          {/* Version Label */}
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: isActive ? 700 : 500, 
                            color: isActive ? 'var(--heading-color)' : 'var(--text-muted)', 
                            marginTop: 8,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            {isDraft ? "📝 DRAFT" : `v${v}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="document-panel" style={{ flex: 1, overflowY: 'auto', padding: '40px 60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 20 }}>
                  <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8, color: 'var(--heading-color)' }}>
                      Cartographie des Services
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Inventaire des services applicatifs actuels regroupés par namespaces.
                    </p>
                  </div>
                  {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) ? (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setEditingService(null);
                        setServiceName('');
                        setServiceId('');
                        setServiceNamespace(selectedNamespace === 'All' ? 'Core' : selectedNamespace);
                        setServiceDescription('');
                        setServiceVersion('1.0.0');
                        setServiceStatus('active');
                        setServiceType('service');
                        setShowServiceModal(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: '0.9rem', flexShrink: 0 }}
                    >
                      <Plus size={16} />
                      Ajouter un Service
                    </button>
                  ) : currentArchVersion !== 'DRAFT' ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      padding: '8px 16px', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: 6, 
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.02)'
                    }}>
                      🔒 Lecture seule
                    </div>
                  ) : null}
                </div>

                {/* Dashboard Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
                  <div style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Total Services</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--heading-color)' }}>{currentArchServices.length}</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Namespaces</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--heading-color)' }}>{namespacesList.length - 1}</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Services Actifs</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{currentArchServices.filter(s => s.status === 'active').length}</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Services Dégradés</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{currentArchServices.filter(s => s.status === 'degraded').length}</div>
                  </div>
                </div>

                {/* PART 1: SCHEMA OPERATIONNEL (INTERACTIVE SCHEMATIC VIEW + CONNECTIONS LIST SIDEBAR) */}
                <div style={{ 
                  display: 'flex', 
                  gap: 24, 
                  marginBottom: 36, 
                  flexWrap: 'wrap'
                }}>
                  {/* Left Column: Interactive Diagram */}
                  <div style={{ 
                    flex: 3, 
                    minWidth: 500,
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 12, 
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    height: 480
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Network size={18} style={{ color: 'var(--accent-glow)' }} />
                        Schéma Opérationnel Interactif
                      </h3>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* System namespaces filter checkbox */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                          <input
                            type="checkbox"
                            id="toggle-system-namespaces"
                            checked={hideSystemNamespaces}
                            onChange={(e) => setHideSystemNamespaces(e.target.checked)}
                            style={{ cursor: 'pointer', margin: 0 }}
                          />
                          <label htmlFor="toggle-system-namespaces" style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)' }}>
                            Masquer les namespaces Système (⚙️)
                          </label>
                        </div>

                        {/* Export to Draw.io Button */}
                        <button
                          type="button"
                          className="split-toggle-btn"
                          onClick={handleExportDrawIo}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem', 
                            height: 26, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            cursor: 'pointer',
                            borderRadius: 6
                          }}
                          title="Télécharger le fichier .drawio de ce schéma pour Draw.io"
                        >
                          <span>📥 Exporter Draw.io</span>
                        </button>

                        {/* Export to PNG Button */}
                        <button
                          type="button"
                          className="split-toggle-btn"
                          onClick={handleExportPng}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem', 
                            height: 26, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            cursor: 'pointer',
                            borderRadius: 6
                          }}
                          title="Télécharger ce schéma sous forme d'image PNG"
                        >
                          <span>📷 Exporter PNG</span>
                        </button>

                        {/* Export to Markdown Report Button */}
                        <button
                          type="button"
                          className="split-toggle-btn"
                          onClick={handleExportCurrentArchMarkdown}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem', 
                            height: 26, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            cursor: 'pointer',
                            borderRadius: 6
                          }}
                          title="Télécharger un rapport Markdown complet avec le schéma inliné"
                        >
                          <span>📄 Rapport Markdown</span>
                        </button>

                        {/* Print / PDF Button */}
                        <button
                          type="button"
                          className="split-toggle-btn"
                          onClick={handleExportCurrentArchPdf}
                          style={{ 
                            padding: '4px 12px', 
                            fontSize: '0.75rem', 
                            height: 26, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            cursor: 'pointer',
                            borderRadius: 6
                          }}
                          title="Télécharger cette vue sous forme de document PDF"
                        >
                          <span>🖨️ PDF</span>
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, position: 'relative', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', background: '#0c0f12' }}>
                      {(() => {
                        // Filter system namespaces if option is checked
                        const visibleNamespaces = currentArchNamespaces.filter(ns => 
                          !hideSystemNamespaces || !ns.isSystem
                        );
                        const visibleNamespaceNames = visibleNamespaces.map(n => n.name);
                        
                        const visibleServices = filteredServices.filter(s => 
                          visibleNamespaceNames.includes(s.namespace)
                        );
                        
                        const visibleConnections = currentArchConnections.filter(c => {
                          const srcSvc = currentArchServices.find(s => s.id === c.from);
                          const tgtSvc = currentArchServices.find(s => s.id === c.to);
                          return srcSvc && tgtSvc && 
                            visibleNamespaceNames.includes(srcSvc.namespace) && 
                            visibleNamespaceNames.includes(tgtSvc.namespace);
                        });

                        return (
                          <OperationalDiagram 
                            services={visibleServices}
                            namespaces={visibleNamespaces}
                            connections={visibleConnections}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Communication Links Manager */}
                  <div style={{ 
                    flex: 1.2, 
                    minWidth: 260, 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 12, 
                    padding: 20, 
                    display: 'flex', 
                    flexDirection: 'column',
                    height: 480
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--heading-color)' }}>
                        Liaisons de Flux ({currentArchConnections.length})
                      </h3>
                      {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                        <button
                          type="button"
                          className="split-toggle-btn"
                          onClick={() => {
                            setConnectionFrom(currentArchServices[0]?.id || '');
                            setConnectionTo(currentArchServices[1]?.id || '');
                            setConnectionLabel('');
                            setShowConnectionModal(true);
                          }}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                          title="Relier des services"
                        >
                          <Plus size={10} />
                          <span>Relier</span>
                        </button>
                      )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                      {currentArchConnections.length === 0 ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 20 }}>
                          Aucune liaison déclarée.
                        </div>
                      ) : (
                        currentArchConnections.map((conn, idx) => {
                          const srcName = currentArchServices.find(s => s.id === conn.from)?.name || conn.from;
                          const tgtName = currentArchServices.find(s => s.id === conn.to)?.name || conn.to;
                          return (
                            <div 
                              key={`${conn.from}-${conn.to}-${idx}`} 
                              style={{ 
                                padding: '10px 12px', 
                                background: 'rgba(255,255,255,0.01)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 10
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: 'var(--heading-color)' }}>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{srcName}</span>
                                  <span style={{ color: 'var(--accent-glow)' }}>➜</span>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tgtName}</span>
                                </div>
                                {conn.label && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    Protocole : {conn.label}
                                  </span>
                                )}
                              </div>
                              {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteConnection(conn.from, conn.to)}
                                  style={{ 
                                    border: 'none', 
                                    background: 'transparent', 
                                    color: '#ef4444', 
                                    opacity: 0.5, 
                                    cursor: 'pointer',
                                    padding: 4
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                                  title="Supprimer la liaison"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* PART 2: SERVICES DESCRIPTION BY NAMESPACE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  {namespacesList
                    .filter(ns => ns !== 'All' && (selectedNamespace === 'All' || ns === selectedNamespace))
                    .map(ns => {
                      const servicesInNamespace = filteredServices.filter(s => s.namespace === ns);
                      if (servicesInNamespace.length === 0) return null;

                      return (
                        <div key={ns} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 24 }}>
                          <h3 style={{ 
                            fontSize: '1rem', 
                            fontWeight: 700, 
                            margin: '0 0 20px 0', 
                            color: 'var(--heading-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: 10
                          }}>
                            <Folder size={18} style={{ color: 'var(--accent-glow)' }} />
                            <span style={{ fontFamily: 'monospace', color: 'var(--accent-glow)' }}>{ns}</span>
                          </h3>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
                            {servicesInNamespace.map(service => {
                              let statusColor = '#ef4444';
                              let statusText = 'Inactif';
                              if (service.status === 'active') {
                                statusColor = '#10b981';
                                statusText = 'Actif';
                              } else if (service.status === 'degraded') {
                                statusColor = '#f59e0b';
                                statusText = 'Dégradé';
                              }

                              return (
                                <div 
                                  key={service.id} 
                                  style={{ 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    borderLeft: `4px solid ${statusColor}`,
                                    borderRadius: '8px', 
                                    padding: 18,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    height: '100%',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          width: 32, 
                                          height: 32, 
                                          background: 'rgba(255,255,255,0.03)', 
                                          borderRadius: 6 
                                        }}>
                                          {getIcon(service.type)}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--heading-color)' }}>
                                            {service.name}
                                          </h4>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            id: {service.id}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <span style={{ 
                                        fontSize: '0.65rem', 
                                        fontWeight: 600, 
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: 'var(--bg-primary)'
                                      }}>
                                        {service.version}
                                      </span>
                                    </div>

                                    <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                      {service.description || "Aucune description fournie."}
                                    </p>
                                  </div>

                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    borderTop: '1px solid var(--border-color)',
                                    paddingTop: 12,
                                    marginTop: 12
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>{statusText}</span>
                                    </div>

                                    {currentArchVersion === 'DRAFT' && user && (user.roles.includes('Architects') || user.roles.some(r => r.toLowerCase().includes('admin'))) && (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                          type="button"
                                          className="split-toggle-btn"
                                          onClick={() => {
                                            setEditingService(service);
                                            setServiceName(service.name);
                                            setServiceId(service.id);
                                            setServiceNamespace(service.namespace);
                                            setServiceDescription(service.description || '');
                                            setServiceVersion(service.version || '1.0.0');
                                            setServiceStatus(service.status || 'active');
                                            setServiceType(service.type || 'service');
                                            setShowServiceModal(true);
                                          }}
                                          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                          title="Modifier"
                                        >
                                          <Edit size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="split-toggle-btn"
                                          onClick={() => handleDeleteService(service.id)}
                                          style={{ padding: '4px 6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                          title="Supprimer"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </main>
          </>
        )}
      </div>

      {/* Operational Service Modal */}
      {showServiceModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <form className="modal-box" onSubmit={handleSaveService} style={{ maxWidth: 460 }}>
            <h3 className="modal-title">{editingService ? "Modifier le Service" : "Ajouter un Service"}</h3>
            <p className="modal-desc">
              Déclarez les métadonnées opérationnelles du composant. Il sera rangé automatiquement sous son namespace.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Nom du Service *</label>
                <input
                  type="text"
                  className="modal-input-field"
                  placeholder="Ex: API d'Historique"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  required
                  style={{ width: '100%', margin: 0 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Namespace / Groupe *</label>
                  <select
                    className="project-select"
                    value={serviceNamespace}
                    onChange={(e) => setServiceNamespace(e.target.value)}
                    style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                    required
                  >
                    {namespacesList.filter(n => n !== 'All').map(ns => (
                      <option key={ns} value={ns}>{ns}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Version</label>
                  <input
                    type="text"
                    className="modal-input-field"
                    placeholder="Ex: 1.0.2"
                    value={serviceVersion}
                    onChange={(e) => setServiceVersion(e.target.value)}
                    style={{ width: '100%', margin: 0 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Type / Icône</label>
                  <select
                    className="project-select"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                  >
                    {Object.entries(groupedTypes).map(([groupName, items]) => (
                      <optgroup key={groupName} label={groupName}>
                        {items.map((item) => (
                          <option key={item.type} value={item.type}>
                            {item.label} ({item.type})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>État opérationnel</label>
                  <select
                    className="project-select"
                    value={serviceStatus}
                    onChange={(e) => setServiceStatus(e.target.value)}
                    style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                  >
                    <option value="active">Actif / Sain</option>
                    <option value="degraded">Dégradé / Alerte</option>
                    <option value="inactive">Inactif / Arrêté</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
                <textarea
                  className="search-input-field"
                  placeholder="Rôle du service, technologies clés, liaisons..."
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  style={{ width: '100%', minHeight: 80, padding: '10px 12px', fontSize: '0.8rem', background: 'var(--bg-primary)' }}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowServiceModal(false);
                  setEditingService(null);
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Namespace Modal */}
      {showNamespaceModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <form className="modal-box" onSubmit={handleSaveNamespace} style={{ maxWidth: 420 }}>
            <h3 className="modal-title">Créer un nouveau Namespace</h3>
            <p className="modal-desc">
              Déclarez un groupe logique de ressources applicatives ou d'infrastructure.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Nom du Namespace *</label>
                <input
                  type="text"
                  className="modal-input-field"
                  placeholder="Ex: Marketing"
                  value={namespaceName}
                  onChange={(e) => setNamespaceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  required
                  style={{ width: '100%', margin: 0 }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Uniquement des lettres, chiffres, tirets et underscores.
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
                <textarea
                  className="search-input-field"
                  placeholder="Rôle global de ce namespace..."
                  value={namespaceDescription}
                  onChange={(e) => setNamespaceDescription(e.target.value)}
                  style={{ width: '100%', minHeight: 60, padding: '10px 12px', fontSize: '0.8rem', background: 'var(--bg-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 2 }}>
                <input
                  type="checkbox"
                  id="is-namespace-system"
                  checked={isNamespaceSystem}
                  onChange={(e) => setIsNamespaceSystem(e.target.checked)}
                  style={{ cursor: 'pointer', margin: 0 }}
                />
                <label htmlFor="is-namespace-system" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                  Marquer comme Namespace Système (Infrastructure)
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowNamespaceModal(false);
                  setNamespaceName('');
                  setNamespaceDescription('');
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!namespaceName.trim()}
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Connection Modal */}
      {showConnectionModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <form className="modal-box" onSubmit={handleSaveConnection} style={{ maxWidth: 420 }}>
            <h3 className="modal-title">Créer une Liaison de Communication</h3>
            <p className="modal-desc">
              Déclarez un flux d'échange de données ou un appel réseau entre deux services applicatifs.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Service Source (Émetteur) *</label>
                <select
                  className="project-select"
                  value={connectionFrom}
                  onChange={(e) => setConnectionFrom(e.target.value)}
                  style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                  required
                >
                  <option value="">-- Choisir le service source --</option>
                  {currentArchServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.namespace})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Service Cible (Récepteur) *</label>
                <select
                  className="project-select"
                  value={connectionTo}
                  onChange={(e) => setConnectionTo(e.target.value)}
                  style={{ width: '100%', height: 38, background: 'var(--bg-primary)', padding: '0 10px', fontSize: '0.8rem' }}
                  required
                >
                  <option value="">-- Choisir le service cible --</option>
                  {currentArchServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.namespace})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Protocole / Libellé (Optionnel)</label>
                <input
                  type="text"
                  className="modal-input-field"
                  placeholder="Ex: REST (JSON), gRPC, AMQP"
                  value={connectionLabel}
                  onChange={(e) => setConnectionLabel(e.target.value)}
                  style={{ width: '100%', margin: 0 }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowConnectionModal(false);
                  setConnectionFrom('');
                  setConnectionTo('');
                  setConnectionLabel('');
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!connectionFrom || !connectionTo}
              >
                Créer la liaison
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <form className="modal-box" onSubmit={handleCreateProject}>
            <h3 className="modal-title">Créer un nouveau projet</h3>
            <p className="modal-desc">
              Saisissez le nom du projet d'architecture. Un squelette de projet vide basé sur le standard arc42 (12 sections) et un modèle de fiche ADR seront automatiquement générés.
            </p>
            <input
              type="text"
              className="modal-input-field"
              placeholder="Ex: Système de Gestion de Stock"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              required
              autoFocus
              disabled={isCreatingProject}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                disabled={isCreatingProject}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isCreatingProject || !newProjectName.trim()}
              >
                {isCreatingProject ? "Création..." : "Créer le projet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
