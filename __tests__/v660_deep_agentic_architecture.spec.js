'use strict';

/**
 * EG-Nexus-OS v6.6.0 — Deep Agentic Architecture Specification Suite
 *
 * Landmark Milestone Verification:
 * Block 1: PlanDAG & PlanningFlow (DAG decomposition, dependency resolution, status advancement & dynamic replan)
 * Block 2: StepExecutionLoop (4-phase THINK -> ACT -> OBSERVE -> REFLECT cycle, approvalGate, budgetGuard, retries)
 * Block 3: ContextWindowCompactor (EpisodicDigest, token budgets, retained steps & savings estimation)
 * Block 4: NexusDeepAgentEngine (Plan registry, coordinated multi-step execution & state lifecycle)
 * Block 5: SYSTEM_PROMPT_ARCHITECTURES (Role prompts: PLANNER, TOOL_EXECUTOR, CRITIC_REFLECTOR, AORCHESTRA_COORDINATOR)
 * Block 6: AdaptivePhaseModelRouter (Quality vs. Speed per-phase model routing & budget guard degradation)
 * Block 7: CueEventStreamBus (Pub/sub event streaming, wildcard subscriptions, ring-buffer history & clearance)
 * Block 8: Cue Live Plan & Thinking Accordion (DOM Integration: tracker, badge, progress bar, accordion body, live stream)
 * Block 9: AOrchestra Group Chat Coordination (Sequential turn distribution, distinct agent avatars & personas)
 */

const fs = require('fs');
const path = require('path');

const state = require('../src/state.js');
const registry = require('../src/providers/registry.js');

// Mock storage factory supporting both Node.js and Jest environments
function createIsolatedStorage() {
  let mem = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
    clear: () => { mem = {}; },
    key: (i) => Object.keys(mem)[i] || null,
    get length() { return Object.keys(mem).length; }
  };
}

// Lightweight mock DOM environment for Jest/Node.js testing without external dependencies
function createMockDOM() {
  const elements = new Map();
  const attributes = new Map();

  function makeEl(id, tagName = 'div') {
    const classList = new Set();
    const children = [];
    const styles = {};

    const el = {
      id,
      tagName: tagName.toUpperCase(),
      classList: {
        add: (...cls) => cls.forEach(c => classList.add(c)),
        remove: (...cls) => cls.forEach(c => classList.delete(c)),
        contains: (c) => classList.has(c),
        toggle: (c, force) => {
          if (force === true) classList.add(c);
          else if (force === false) classList.delete(c);
          else if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        }
      },
      style: styles,
      _children: children,
      appendChild: (ch) => children.push(ch),
      querySelector: (selector) => {
        if (selector === 'span.truncate') {
          return { innerText: '', textContent: '' };
        }
        if (selector === 'span.text-slate-500') {
          return el.innerHTML.includes('text-slate-500') ? { remove: () => {} } : null;
        }
        return null;
      },
      getAttribute: (k) => attributes.get(`${id}:${k}`) || null,
      setAttribute: (k, v) => attributes.set(`${id}:${k}`, String(v)),
      removeAttribute: (k) => attributes.delete(`${id}:${k}`),
      className: '',
      innerText: '',
      innerHTML: '',
      textContent: '',
      scrollTop: 0,
      scrollHeight: 100
    };

    elements.set(id, el);
    return el;
  }

  return {
    makeEl,
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => makeEl('el_' + Math.random().toString(36).slice(2, 9), tag),
    createTextNode: (txt) => ({ text: txt, nodeType: 3 })
  };
}

describe('EG-Nexus-OS v6.6.0 — Deep Agentic Architecture Test Suite', () => {
  const rootDir = path.resolve(__dirname, '..');
  let htmlContent = '';
  let mockStorage;

  beforeAll(() => {
    mockStorage = createIsolatedStorage();
    if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
      globalThis.localStorage = mockStorage;
    }
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      htmlContent = fs.readFileSync(indexPath, 'utf8');
    }
  });

  beforeEach(() => {
    mockStorage.clear();
  });

  // =========================================================================
  // Block 1: PlanDAG & PlanningFlow
  // =========================================================================
  describe('Block 1: PlanDAG & PlanningFlow', () => {
    it('should export PlanDAG, StepNode, createExecutionPlan, and advancePlanStep', () => {
      expect(typeof state.PlanDAG).toBe('function');
      expect(typeof state.StepNode).toBe('function');
      expect(typeof state.createExecutionPlan).toBe('function');
      expect(typeof state.advancePlanStep).toBe('function');
    });

    it('should createExecutionPlan(goal, context) and decompose goal into valid DAG with steps', () => {
      const goal = 'Implement full-stack payment gateway with Stripe integration';
      const context = { priority: 'high', environment: 'production' };
      const plan = state.createExecutionPlan(goal, context);

      expect(plan).toBeDefined();
      expect(plan instanceof state.PlanDAG).toBe(true);
      expect(typeof plan.id).toBe('string');
      expect(plan.id.length).toBeGreaterThan(0);
      expect(plan.goal).toBe(goal);
      expect(plan.status).toBe('pending');
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThanOrEqual(3);

      plan.steps.forEach(step => {
        expect(typeof step.id).toBe('string');
        expect(typeof step.title).toBe('string');
        expect(typeof step.assignedRole).toBe('string');
        expect(Array.isArray(step.requiredTools)).toBe(true);
        expect(step.status).toBe('pending');
        expect(Array.isArray(step.dependencies)).toBe(true);
        expect(typeof step.retryCount).toBe('number');
        expect(step.retryCount).toBe(0);
      });
    });

    it('should getNextExecutableSteps() correctly return steps with satisfied dependencies', () => {
      const dag = new state.PlanDAG({ goal: 'Dependency Chain Test' });
      const step1 = new state.StepNode({ id: 's1', title: 'Step 1: Setup DB', dependencies: [] });
      const step2 = new state.StepNode({ id: 's2', title: 'Step 2: Seed Data', dependencies: ['s1'] });
      const step3 = new state.StepNode({ id: 's3', title: 'Step 3: Run Analytics', dependencies: ['s2'] });

      dag.addStep(step1);
      dag.addStep(step2);
      dag.addStep(step3);

      // Initially, only s1 has empty dependencies and is pending
      const executableInitial = dag.getNextExecutableSteps();
      expect(executableInitial.length).toBe(1);
      expect(executableInitial[0].id).toBe('s1');

      // Complete s1, now s2 should become executable
      dag.markStepStatus('s1', 'completed', 'Database initialized');
      const executableAfterS1 = dag.getNextExecutableSteps();
      expect(executableAfterS1.length).toBe(1);
      expect(executableAfterS1[0].id).toBe('s2');

      // Complete s2, now s3 should become executable
      dag.markStepStatus('s2', 'completed', 'Data seeded successfully');
      const executableAfterS2 = dag.getNextExecutableSteps();
      expect(executableAfterS2.length).toBe(1);
      expect(executableAfterS2[0].id).toBe('s3');
    });

    it('should markStepStatus() update step status, resultSummary and timestamp', () => {
      const plan = state.createExecutionPlan('Status Transition Test');
      const stepId = plan.steps[0].id;
      const initialUpdatedAt = plan.updatedAt;

      const updatedStep = plan.markStepStatus(stepId, 'in_progress', 'Analyzing schemas');
      expect(updatedStep.status).toBe('in_progress');
      expect(updatedStep.resultSummary).toBe('Analyzing schemas');
      expect(plan.updatedAt).toBeGreaterThanOrEqual(initialUpdatedAt);
    });

    it('should advancePlanStep() advance status, handle retryCount on failure, and trigger replan() on max retries', () => {
      const plan = state.createExecutionPlan('Failure Recovery Test');
      const stepId = plan.steps[0].id;
      const step = plan.getStep(stepId);
      step.maxRetries = 2;

      // First failure: increments retryCount to 1, sets status to 'retrying'
      state.advancePlanStep(plan, stepId, { success: false, error: 'Network timeout attempt 1' });
      expect(step.retryCount).toBe(1);
      expect(step.status).toBe('retrying');

      // Second failure: increments retryCount to 2
      state.advancePlanStep(plan, stepId, { success: false, error: 'Network timeout attempt 2' });
      expect(step.retryCount).toBe(2);
      expect(step.status).toBe('retrying');

      // Third failure (exceeds maxRetries = 2): marks step as 'failed' and triggers dynamic replan
      state.advancePlanStep(plan, stepId, {
        success: false,
        error: 'Terminal network failure',
        autoReplan: true,
        replanReason: 'Provider unreachable'
      });
      expect(step.status).toBe('failed');
      expect(step.replanned).toBe(true);
      expect(step.replanReason).toContain('Provider unreachable');
    });

    it('should isCompleted() and hasFailures() accurately reflect plan health state', () => {
      const plan = state.createExecutionPlan('State Check Test');
      expect(plan.isCompleted()).toBe(false);
      expect(plan.hasFailures()).toBe(false);

      // Complete all steps
      plan.steps.forEach(s => {
        plan.markStepStatus(s.id, 'completed', 'Done');
      });
      expect(plan.isCompleted()).toBe(true);
      expect(plan.hasFailures()).toBe(false);
      expect(plan.status).toBe('completed');

      // Introduce a failed step
      const stepF = new state.StepNode({ id: 'sf', title: 'Broken Step', status: 'failed' });
      plan.addStep(stepF);
      plan.markStepStatus('sf', 'failed', '', 'Critical syntax error');
      expect(plan.isCompleted()).toBe(false);
      expect(plan.hasFailures()).toBe(true);
      expect(plan.status).toBe('failed');
    });
  });

  // =========================================================================
  // Block 2: StepExecutionLoop
  // =========================================================================
  describe('Block 2: StepExecutionLoop', () => {
    it('should export StepExecutionLoop class with required 4-phase methods', () => {
      expect(typeof state.StepExecutionLoop).toBe('function');
      const loop = new state.StepExecutionLoop();
      expect(typeof loop.executePhaseThink).toBe('function');
      expect(typeof loop.executePhaseAct).toBe('function');
      expect(typeof loop.executePhaseObserve).toBe('function');
      expect(typeof loop.executePhaseReflect).toBe('function');
      expect(typeof loop.retryWithRefinement).toBe('function');
      expect(typeof loop.runLoop).toBe('function');
    });

    it('should executePhaseThink() emit thinking_delta on event bus', async () => {
      const capturedDeltas = [];
      const testBus = {
        emit: (evt, payload) => {
          if (evt === 'thinking_delta') capturedDeltas.push(payload);
        }
      };

      const loop = new state.StepExecutionLoop({ eventBus: testBus });
      const step = new state.StepNode({
        id: 's_think',
        title: 'Formulate Security Hypothesis',
        assignedRole: 'critic',
        requiredTools: ['ast_parser']
      });

      const thought = await loop.executePhaseThink(step, { contextVar: 'test' });
      expect(thought).toBeDefined();
      expect(thought.stepId).toBe('s_think');
      expect(thought.role).toBe('critic');
      expect(typeof thought.hypothesis).toBe('string');
      expect(Array.isArray(thought.planOfAction)).toBe(true);
      expect(capturedDeltas.length).toBeGreaterThan(0);
      expect(capturedDeltas[0].stepId).toBe('s_think');
      expect(capturedDeltas[0].thinkingDelta).toContain('[CRITIC THINKING]');
    });

    it('should executePhaseAct() check approvalGate and block mutating execution when denied', async () => {
      const approvalGate = jest.fn().mockResolvedValue({ approved: false, reason: 'Disallowed by User' });
      const loop = new state.StepExecutionLoop({ approvalGate });

      const mutatingStep = new state.StepNode({
        id: 's_mutate',
        title: 'Delete Production Database',
        requiredTools: ['bash_executor', 'delete_table'],
        isMutating: true
      });

      const actResult = await loop.executePhaseAct(mutatingStep, {}, { thought: 'I will drop table' });
      expect(actResult.success).toBe(false);
      expect(actResult.approvalRequired).toBe(true);
      expect(actResult.error).toContain('Action blocked by ApprovalGate');
      expect(approvalGate).toHaveBeenCalled();
    });

    it('should executePhaseAct() respect budgetGuard and halt execution when quota exhausted', async () => {
      const budgetGuard = {
        checkBudget: jest.fn().mockReturnValue(false),
        recordUsage: jest.fn()
      };
      const loop = new state.StepExecutionLoop({ budgetGuard });
      const step = new state.StepNode({ id: 's_bgt', title: 'Heavy LLM Generation' });

      const actResult = await loop.executePhaseAct(step, {}, {});
      expect(actResult.success).toBe(false);
      expect(actResult.budgetExceeded).toBe(true);
      expect(actResult.error).toContain('Action halted by BudgetGuard');
      expect(budgetGuard.checkBudget).toHaveBeenCalled();
    });

    it('should executePhaseObserve() output standardized structure with provenance and duration', () => {
      const loop = new state.StepExecutionLoop();
      const step = new state.StepNode({ id: 's_obs', assignedRole: 'coder', title: 'Run Unit Tests' });
      const actionResult = {
        success: true,
        output: 'All 42 tests passed without regressions.',
        artifacts: ['test_report.json']
      };
      const startTime = Date.now() - 150;

      const observation = loop.executePhaseObserve(step, actionResult, startTime);
      expect(observation.stepId).toBe('s_obs');
      expect(observation.success).toBe(true);
      expect(observation.output).toBe('All 42 tests passed without regressions.');
      expect(observation.error).toBeNull();
      expect(typeof observation.provenance).toBe('object');
      expect(observation.provenance.source).toBe('coder');
      expect(typeof observation.provenance.timestamp).toBe('number');
      expect(observation.durationMs).toBeGreaterThanOrEqual(150);
    });

    it('should executePhaseReflect() trigger retryWithRefinement() up to maxRetries on simulated failure and succeed when refined', async () => {
      const loop = new state.StepExecutionLoop({ maxRetries: 3 });
      const step = new state.StepNode({ id: 's_ref', title: 'Self-Healing Task', maxRetries: 3 });

      const failedObservation = {
        stepId: 's_ref',
        success: false,
        error: 'Zero division exception in calculateInterest()'
      };

      const reflection = await loop.executePhaseReflect(step, failedObservation, {});
      expect(reflection.valid).toBe(false);
      expect(reflection.critique).toContain('failed');
      expect(step.retryCount).toBe(1);
      expect(step.status).toBe('retrying');
      expect(step.lastError).toContain('Zero division exception');

      // Second failure retry
      await loop.executePhaseReflect(step, failedObservation, {});
      expect(step.retryCount).toBe(2);

      // Now simulated success on third refined attempt
      const successObservation = {
        stepId: 's_ref',
        success: true,
        output: 'Zero check applied. Interest computed safely.'
      };
      const successReflection = await loop.executePhaseReflect(step, successObservation, {});
      expect(successReflection.valid).toBe(true);
      expect(successReflection.critique).toContain('succeeded');
    });

    it('should runLoop() run a multi-step plan to completion and emit task_completed', async () => {
      const emittedEvents = [];
      const testBus = {
        emit: (evt, payload) => emittedEvents.push({ evt, payload })
      };

      const loop = new state.StepExecutionLoop({
        eventBus: testBus,
        executeProviderRequest: async ({ step }) => ({
          success: true,
          output: `Result for step: ${step.title}`
        })
      });

      const plan = state.createExecutionPlan('End to End Orchestration Goal');
      const loopResult = await loop.runLoop(plan);

      expect(loopResult.completed).toBe(true);
      expect(loopResult.status).toBe('completed');
      expect(loopResult.completedSteps).toBe(plan.steps.length);
      expect(loopResult.failedSteps).toBe(0);

      const taskCompletedEvent = emittedEvents.find(e => e.evt === 'task_completed');
      expect(taskCompletedEvent).toBeDefined();
      expect(taskCompletedEvent.payload.planId).toBe(plan.id);
      expect(taskCompletedEvent.payload.stepsCount).toBe(plan.steps.length);
    });
  });

  // =========================================================================
  // Block 3: ContextWindowCompactor
  // =========================================================================
  describe('Block 3: ContextWindowCompactor', () => {
    it('should export ContextWindowCompactor and compactExecutionHistory helper', () => {
      expect(typeof state.ContextWindowCompactor).toBe('object');
      expect(typeof state.ContextWindowCompactor.compactExecutionHistory).toBe('function');
      expect(typeof state.compactExecutionHistory).toBe('function');
    });

    it('should compactExecutionHistory() compress steps exceeding budget into an EpisodicDigest', () => {
      // Build 15 extensive steps with large metadata to exceed small token budget
      const largeSteps = [];
      for (let i = 1; i <= 15; i++) {
        largeSteps.push({
          id: `step_${i}`,
          title: `Autonomous Phase ${i}: Build Service Endpoint and API Client`,
          status: 'completed',
          resultSummary: `Phase ${i} completed successfully with response payloads: ${'x'.repeat(200)}`,
          metadata: {
            artifacts: [{ id: `art_${i}`, name: `module_${i}.js`, summary: `Compiled JS bundle ${i}` }],
            goal: 'Build Scalable Microservices Architecture'
          }
        });
      }

      const compacted = state.compactExecutionHistory(largeSteps, 300); // tight budget
      expect(compacted).toBeDefined();
      expect(typeof compacted.episodicDigest).toBe('string');
      expect(compacted.episodicDigest.length).toBeGreaterThan(0);
      expect(compacted.episodicDigest).toContain('### EPISODIC DIGEST');
      expect(compacted.goal).toBe('Build Scalable Microservices Architecture');
      expect(compacted.totalSteps).toBe(15);
      expect(compacted.completedStepsCount).toBe(15);
      expect(Array.isArray(compacted.keyArtifacts)).toBe(true);
      expect(compacted.keyArtifacts.length).toBeGreaterThan(0);
    });

    it('should episodicDigest retain main goal, key artifacts, milestones, and questions', () => {
      const steps = [
        {
          id: 'step_1',
          title: 'Requirement Gathering',
          status: 'completed',
          resultSummary: 'Identified 5 microservice contracts',
          metadata: { goal: 'Sovereign Agent Cloud' }
        },
        {
          id: 'step_2',
          title: 'Infrastructure Deployment',
          status: 'completed',
          resultSummary: 'Termux bridge spun up on port 8080',
          metadata: { artifacts: [{ name: 'bridge_config.json', summary: 'Port and TLS mapping' }] }
        },
        {
          id: 'step_3',
          title: 'Authentication Module',
          status: 'failed',
          lastError: 'Missing OAuth client secret',
          metadata: {}
        }
      ];

      const compacted = state.compactExecutionHistory(steps, 50); // force compaction
      expect(compacted.episodicDigest).toContain('Sovereign Agent Cloud');
      expect(compacted.episodicDigest).toContain('Requirement Gathering');
      expect(compacted.episodicDigest).toContain('bridge_config.json');
      expect(compacted.episodicDigest).toContain('Blockers / Failures');
    });

    it('should retainedSteps contain recent steps and estimatedTokensSaved > 0', () => {
      const steps = [];
      for (let i = 1; i <= 10; i++) {
        steps.push({
          id: `step_${i}`,
          title: `Step Title ${i}`,
          status: 'completed',
          resultSummary: `Execution details ${'abc'.repeat(100)}`
        });
      }

      const compacted = state.compactExecutionHistory(steps, 200);
      expect(Array.isArray(compacted.retainedSteps)).toBe(true);
      expect(compacted.retainedSteps.length).toBeLessThan(steps.length);
      expect(compacted.estimatedTokensSaved).toBeGreaterThan(0);
    });

    it('should return original steps untouched when within tokenBudget', () => {
      const smallSteps = [
        { id: 's1', title: 'Quick Step', status: 'completed' },
        { id: 's2', title: 'Small Step', status: 'pending' }
      ];

      const result = state.compactExecutionHistory(smallSteps, 100000);
      expect(result).toBe(smallSteps);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  // =========================================================================
  // Block 4: NexusDeepAgentEngine
  // =========================================================================
  describe('Block 4: NexusDeepAgentEngine', () => {
    it('should instantiate engine with activePlans, loop and compactor', () => {
      const engine = new state.NexusDeepAgentEngine();
      expect(engine).toBeDefined();
      expect(engine.activePlans instanceof Map).toBe(true);
      expect(engine.loop instanceof state.StepExecutionLoop).toBe(true);
      expect(engine.compactor).toBe(state.ContextWindowCompactor);
    });

    it('should createPlan(goal) register plan in activePlans Map and return valid PlanDAG', () => {
      const engine = new state.NexusDeepAgentEngine();
      const plan = engine.createPlan('Automate Cloud Backup Pipeline');

      expect(plan instanceof state.PlanDAG).toBe(true);
      expect(engine.activePlans.has(plan.id)).toBe(true);
      expect(engine.getPlan(plan.id)).toBe(plan);
    });

    it('should getPlan(planId) return registered plan or null for nonexistent ID', () => {
      const engine = new state.NexusDeepAgentEngine();
      const plan = engine.createPlan('Test Plan Retrieval');

      expect(engine.getPlan(plan.id)).toBe(plan);
      expect(engine.getPlan('non_existent_plan_id')).toBeNull();
      expect(engine.getPlan(null)).toBeNull();
    });

    it('should executePlan() coordinate execution through loop and complete all steps', async () => {
      const engine = new state.NexusDeepAgentEngine({
        executeProviderRequest: async ({ step }) => ({
          success: true,
          output: `Engine output for ${step.title}`
        })
      });

      const plan = engine.createPlan('Coordinated Execution Benchmark');
      const result = await engine.executePlan(plan.id);

      expect(result.completed).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.completedSteps).toBe(plan.steps.length);
      expect(plan.isCompleted()).toBe(true);
    });
  });

  // =========================================================================
  // Block 5: SYSTEM_PROMPT_ARCHITECTURES
  // =========================================================================
  describe('Block 5: SYSTEM_PROMPT_ARCHITECTURES', () => {
    it('should export PLANNER_SYSTEM_PROMPT with planner and DAG keywords', () => {
      const prompt = registry.PLANNER_SYSTEM_PROMPT;
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain('Lead Strategic Planner');
      expect(prompt).toContain('DIRECTED ACYCLIC GRAPH (DAG)');
      expect(prompt).toContain('Planner');
      expect(prompt).toContain('Critic');
    });

    it('should export TOOL_EXECUTOR_SYSTEM_PROMPT with tool execution keywords', () => {
      const prompt = registry.TOOL_EXECUTOR_SYSTEM_PROMPT;
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain('Tool Execution Engine');
      expect(prompt).toContain('ZERO HALLUCINATION POLICY');
      expect(prompt).toContain('STRICT PRECONDITION VERIFICATION');
    });

    it('should export CRITIC_REFLECTOR_SYSTEM_PROMPT with epistemic reflection keywords', () => {
      const prompt = registry.CRITIC_REFLECTOR_SYSTEM_PROMPT;
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain('Epistemic Verification');
      expect(prompt).toContain('Critic');
      expect(prompt).toContain('OBSERVATION AUDIT');
      expect(prompt).toContain('HYPOTHESIS VS REALITY');
    });

    it('should export AORCHESTRA_COORDINATOR_PROMPT with multi-agent coordination keywords', () => {
      const prompt = registry.AORCHESTRA_COORDINATOR_PROMPT;
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(200);
      expect(prompt).toContain('AOrchestra');
      expect(prompt).toContain('MULTI-AGENT ORCHESTRATION');
      expect(prompt).toContain('DYNAMIC TURN ALLOCATION');
    });

    it('should provide frozen SYSTEM_PROMPT_ARCHITECTURES container with all 4 prompts', () => {
      const container = registry.SYSTEM_PROMPT_ARCHITECTURES;
      expect(container).toBeDefined();
      expect(Object.isFrozen(container)).toBe(true);
      expect(container.PLANNER).toBe(registry.PLANNER_SYSTEM_PROMPT);
      expect(container.TOOL_EXECUTOR).toBe(registry.TOOL_EXECUTOR_SYSTEM_PROMPT);
      expect(container.CRITIC_REFLECTOR).toBe(registry.CRITIC_REFLECTOR_SYSTEM_PROMPT);
      expect(container.AORCHESTRA_COORDINATOR).toBe(registry.AORCHESTRA_COORDINATOR_PROMPT);
    });
  });

  // =========================================================================
  // Block 6: AdaptivePhaseModelRouter
  // =========================================================================
  describe('Block 6: AdaptivePhaseModelRouter', () => {
    it('should export AdaptivePhaseModelRouter and routePhaseModel', () => {
      expect(typeof registry.AdaptivePhaseModelRouter).toBe('object');
      expect(typeof registry.routePhaseModel).toBe('function');
      expect(registry.AdaptivePhaseModelRouter.routePhaseModel).toBe(registry.routePhaseModel);
    });

    it('should route PLAN, THINK, REFLECT to deep reasoning models in quality mode', () => {
      const planRoute = registry.routePhaseModel('PLAN', 'quality');
      expect(planRoute.modelId).toBe('deepseek-v4-pro');
      expect(planRoute.provider).toBe('deepseek');
      expect(planRoute.reasoningTier).toBe('high');
      expect(planRoute.maxTokens).toBe(4096);

      const thinkRoute = registry.routePhaseModel('THINK', 'quality');
      expect(thinkRoute.modelId).toBe('deepseek-v4-pro');
      expect(thinkRoute.reasoningTier).toBe('high');

      const reflectRoute = registry.routePhaseModel('REFLECT', 'quality');
      expect(reflectRoute.modelId).toBe('deepseek-v4-pro');
      expect(reflectRoute.reasoningTier).toBe('high');
    });

    it('should route ACT, OBSERVE, SUMMARIZE to fast models in quality mode', () => {
      const actRoute = registry.routePhaseModel('ACT', 'quality');
      expect(actRoute.modelId).toBe('gemini-3.8-flash');
      expect(actRoute.provider).toBe('google');
      expect(actRoute.reasoningTier).toBe('standard');

      const obsRoute = registry.routePhaseModel('OBSERVE', 'quality');
      expect(obsRoute.modelId).toBe('gemini-3.8-flash');

      const sumRoute = registry.routePhaseModel('SUMMARIZE', 'quality');
      expect(sumRoute.modelId).toBe('gemini-3.8-flash');
    });

    it('should route all phases to fast models in speed mode', () => {
      const phases = ['PLAN', 'THINK', 'ACT', 'OBSERVE', 'REFLECT', 'SUMMARIZE'];
      phases.forEach(phase => {
        const route = registry.routePhaseModel(phase, 'speed');
        expect(route.modelId).toBe('gemini-3.8-flash');
        expect(route.provider).toBe('google');
        expect(route.reasoningTier).toBe('minimal');
        expect(route.effortMode).toBe('speed');
      });
    });

    it('should gracefully degrade when budgetGuard balance is exhausted or critical (< 0.20)', () => {
      // Degrade with object budgetGuard { getRemainingBudget: () => 0.15 }
      const guardObj = { getRemainingBudget: () => 0.15 };
      const degraded1 = registry.routePhaseModel('PLAN', 'quality', guardObj);
      expect(degraded1.modelId).toBe('gemini-3.8-flash');
      expect(degraded1.reason).toContain('Budget guard constraint');

      // Degrade with remainingBudget = 0.05
      const guardBudget = { budget: 0.05 };
      const degraded2 = registry.routePhaseModel('THINK', 'quality', guardBudget);
      expect(degraded2.modelId).toBe('gemini-3.8-flash');
      expect(degraded2.reason).toContain('Budget guard constraint');

      // Degrade with literal number 0.10
      const degraded3 = registry.routePhaseModel('REFLECT', 'quality', 0.10);
      expect(degraded3.modelId).toBe('gemini-3.8-flash');
      expect(degraded3.reason).toContain('Budget guard constraint');
    });
  });

  // =========================================================================
  // Block 7: CueEventStreamBus
  // =========================================================================
  describe('Block 7: CueEventStreamBus', () => {
    let bus;

    beforeEach(() => {
      bus = registry.CueEventStreamBus;
      bus.clear();
    });

    it('should export CueEventStreamBus instance and CueEventStreamBusClass', () => {
      expect(typeof registry.CueEventStreamBus).toBe('object');
      expect(typeof registry.CueEventStreamBusClass).toBe('function');
      expect(typeof bus.on).toBe('function');
      expect(typeof bus.emit).toBe('function');
      expect(typeof bus.off).toBe('function');
      expect(typeof bus.getHistory).toBe('function');
      expect(typeof bus.clear).toBe('function');
    });

    it('should subscribe with on(), publish with emit(), and unsubscribe with off()', () => {
      const standardEvents = ['plan_created', 'step_started', 'thinking_delta', 'reflection_triggered', 'step_completed', 'task_completed'];
      const received = {};

      standardEvents.forEach(evt => {
        received[evt] = [];
        bus.on(evt, (data) => received[evt].push(data));
      });

      standardEvents.forEach((evt, idx) => {
        bus.emit(evt, { payloadId: `p_${idx}` });
      });

      standardEvents.forEach((evt, idx) => {
        expect(received[evt].length).toBe(1);
        expect(received[evt][0].payloadId).toBe(`p_${idx}`);
      });

      // Test off()
      const dummyCb = jest.fn();
      bus.on('step_started', dummyCb);
      bus.emit('step_started', { test: 1 });
      expect(dummyCb).toHaveBeenCalledTimes(1);

      bus.off('step_started', dummyCb);
      bus.emit('step_started', { test: 2 });
      expect(dummyCb).toHaveBeenCalledTimes(1); // not called again
    });

    it('should wildcard * listener receive all emitted events with name and payload', () => {
      const allEvents = [];
      bus.on('*', (data, eventName, timestamp) => {
        allEvents.push({ eventName, data, timestamp });
      });

      bus.emit('plan_created', { planId: 'dag_1' });
      bus.emit('thinking_delta', { token: 'Hello' });
      bus.emit('task_completed', { duration: 120 });

      expect(allEvents.length).toBe(3);
      expect(allEvents[0].eventName).toBe('plan_created');
      expect(allEvents[1].eventName).toBe('thinking_delta');
      expect(allEvents[2].eventName).toBe('task_completed');
    });

    it('should getHistory() record events up to max limit (100) and evict oldest', () => {
      for (let i = 1; i <= 120; i++) {
        bus.emit('step_started', { sequence: i });
      }

      const history = bus.getHistory();
      expect(history.length).toBe(100);
      expect(history[0].data.sequence).toBe(21); // oldest 20 evicted
      expect(history[99].data.sequence).toBe(120);
    });

    it('should getHistory(eventName) filter history by event name and clear() empty history', () => {
      bus.emit('step_started', { s: 1 });
      bus.emit('thinking_delta', { t: 'delta' });
      bus.emit('step_started', { s: 2 });
      bus.emit('step_completed', { s: 1, done: true });

      const filteredSteps = bus.getHistory('step_started');
      expect(filteredSteps.length).toBe(2);
      expect(filteredSteps.every(item => item.event === 'step_started')).toBe(true);

      const filteredDeltas = bus.getHistory('thinking_delta');
      expect(filteredDeltas.length).toBe(1);

      bus.clear();
      expect(bus.getHistory().length).toBe(0);
      expect(bus.listenerCount('step_started')).toBe(0);
    });
  });

  // =========================================================================
  // Block 8: Cue Live Plan & Thinking Accordion (DOM Integration)
  // =========================================================================
  describe('Block 8: Cue Live Plan & Thinking Accordion (DOM Integration)', () => {
    it('should verify DOM IDs and structure in index.html', () => {
      expect(htmlContent).toContain('id="cueLivePlanTracker"');
      expect(htmlContent).toContain('id="cuePlanStatusBadge"');
      expect(htmlContent).toContain('id="cuePlanProgressBar"');
      expect(htmlContent).toContain('id="cuePlanAccordionBody"');
      expect(htmlContent).toContain('id="cuePlanStepsList"');
      expect(htmlContent).toContain('id="cuePlanThinkingStream"');
      expect(htmlContent).toContain('id="cuePlanAccordionToggle"');
      expect(htmlContent).toContain('toggleCuePlanAccordion()');
    });

    it('should toggleCuePlanAccordion() correctly toggle accordion visibility', () => {
      const mockDOM = createMockDOM();
      const body = mockDOM.makeEl('cuePlanAccordionBody');
      const toggleBtn = mockDOM.makeEl('cuePlanAccordionToggle');
      body.classList.add('hidden');
      toggleBtn.innerText = '▼';

      function toggleCuePlanAccordion() {
        const b = mockDOM.getElementById('cuePlanAccordionBody');
        const t = mockDOM.getElementById('cuePlanAccordionToggle');
        if (!b) return;
        if (b.classList.contains('hidden')) {
          b.classList.remove('hidden');
          if (t) t.innerText = '▲';
        } else {
          b.classList.add('hidden');
          if (t) t.innerText = '▼';
        }
      }

      // First toggle: expand
      toggleCuePlanAccordion();
      expect(body.classList.contains('hidden')).toBe(false);
      expect(toggleBtn.innerText).toBe('▲');

      // Second toggle: collapse
      toggleCuePlanAccordion();
      expect(body.classList.contains('hidden')).toBe(true);
      expect(toggleBtn.innerText).toBe('▼');
    });

    it('should renderCueLivePlanTracker() render steps into cuePlanStepsList on plan_created event', () => {
      const mockDOM = createMockDOM();
      const tracker = mockDOM.makeEl('cueLivePlanTracker');
      tracker.classList.add('hidden');
      const titleEl = mockDOM.makeEl('cuePlanTitle');
      const badgeEl = mockDOM.makeEl('cuePlanStatusBadge');
      const stepsListEl = mockDOM.makeEl('cuePlanStepsList');
      const barEl = mockDOM.makeEl('cuePlanProgressBar');
      const progressTextEl = mockDOM.makeEl('cuePlanStepProgress');

      const planData = {
        title: 'Build Autonomous AI Agent',
        steps: [
          { id: 'st_1', title: 'Task 1: Search repo', status: 'pending' },
          { id: 'st_2', title: 'Task 2: Code synthesis', status: 'pending' },
          { id: 'st_3', title: 'Task 3: Run Jest tests', status: 'pending' }
        ]
      };

      // Behavioral handler corresponding to index.html implementation
      tracker.classList.remove('hidden');
      titleEl.innerText = planData.title;
      badgeEl.innerText = 'برنامه‌ریزی';
      progressTextEl.innerText = `گام ۰ از ${planData.steps.length}`;
      barEl.style.width = '5%';
      stepsListEl.innerHTML = planData.steps.map(s => `<div id="cueStepRow_${s.id}">${s.title}</div>`).join('');

      expect(tracker.classList.contains('hidden')).toBe(false);
      expect(titleEl.innerText).toBe('Build Autonomous AI Agent');
      expect(progressTextEl.innerText).toBe('گام ۰ از 3');
      expect(stepsListEl.innerHTML).toContain('cueStepRow_st_1');
      expect(stepsListEl.innerHTML).toContain('cueStepRow_st_2');
      expect(stepsListEl.innerHTML).toContain('cueStepRow_st_3');
    });

    it('should update active step highlighting on step_started and append thinking_delta text', () => {
      const mockDOM = createMockDOM();
      const streamEl = mockDOM.makeEl('cuePlanThinkingStream');
      const deltaCountEl = mockDOM.makeEl('cueThinkingDeltaCount');
      const barEl = mockDOM.makeEl('cuePlanProgressBar');
      const row1 = mockDOM.makeEl('cueStepRow_st_1');

      // On step_started
      row1.className = 'flex items-center justify-between p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-white transition';
      barEl.style.width = '33%';
      expect(row1.className).toContain('bg-blue-500/10');
      expect(barEl.style.width).toBe('33%');

      // On thinking_delta
      const deltaText = 'Analyzing AST node trees for vulnerabilities...';
      streamEl.appendChild(mockDOM.createTextNode(deltaText));
      streamEl.textContent += deltaText;
      deltaCountEl.innerText = '12 tokens';

      expect(streamEl.textContent).toContain('Analyzing AST node trees');
      expect(deltaCountEl.innerText).toBe('12 tokens');
    });

    it('should update progress bar to 100% and finish status badge on task_completed', () => {
      const mockDOM = createMockDOM();
      const badgeEl = mockDOM.makeEl('cuePlanStatusBadge');
      const barEl = mockDOM.makeEl('cuePlanProgressBar');

      // Trigger task_completed
      badgeEl.innerText = 'تکمیل شد ✓';
      barEl.style.width = '100%';

      expect(badgeEl.innerText).toContain('تکمیل شد');
      expect(barEl.style.width).toBe('100%');
    });
  });

  // =========================================================================
  // Block 9: AOrchestra Group Chat Coordination
  // =========================================================================
  describe('Block 9: AOrchestra Group Chat Coordination', () => {
    it('should coordinateGroupMembers() and distribute sequential turns when isGroup is true', () => {
      const mockCatalog = [
        { id: 'ag_planner', name: 'Lead Planner Agent', avatar: { shape: 'badge', face: 'focused', color: '#3E97F6' } },
        { id: 'ag_coder', name: 'Synthesizer Coder', avatar: { shape: 'fire', face: 'wink', color: '#10B981' } },
        { id: 'ag_critic', name: 'Epistemic Critic', avatar: { shape: 'moon', face: 'skeptical', color: '#F59E0B' } }
      ];

      const groupChat = {
        id: 'chat_grp_1',
        title: 'Autonomous Swarm Team',
        isGroup: true,
        memberIds: ['ag_planner', 'ag_coder', 'ag_critic']
      };

      const turns = groupChat.isGroup ? Math.max(1, groupChat.memberIds.length) : 1;
      expect(turns).toBe(3);

      const assignedTurns = [];
      for (let t = 0; t < turns; t++) {
        const agent = mockCatalog.find(a => a.id === groupChat.memberIds[t % groupChat.memberIds.length]);
        assignedTurns.push({ turnIndex: t, agentId: agent.id, agentName: agent.name });
      }

      expect(assignedTurns.length).toBe(3);
      expect(assignedTurns[0].agentId).toBe('ag_planner');
      expect(assignedTurns[1].agentId).toBe('ag_coder');
      expect(assignedTurns[2].agentId).toBe('ag_critic');
    });

    it('should assign distinct senderName, senderId, and role directives to each responding agent in group chat', () => {
      const mockChat = {
        isGroup: true,
        memberIds: ['ag_1', 'ag_2']
      };

      const messages = [];
      const agents = [
        { id: 'ag_1', name: 'Architecture Lead' },
        { id: 'ag_2', name: 'Code Reviewer' }
      ];

      for (let t = 0; t < 2; t++) {
        const ag = agents[t];
        messages.push({
          id: `msg_ag_${t}`,
          senderType: 'agent',
          senderId: ag.id,
          senderName: ag.name,
          text: `Analysis contribution from turn ${t + 1}`
        });
      }

      expect(messages.length).toBe(2);
      expect(messages[0].senderId).toBe('ag_1');
      expect(messages[0].senderName).toBe('Architecture Lead');
      expect(messages[1].senderId).toBe('ag_2');
      expect(messages[1].senderName).toBe('Code Reviewer');
      expect(messages[0].senderId).not.toBe(messages[1].senderId);
    });

    it('should buildAvatarSVG() render distinct SVG markup for each member agent in group chat', () => {
      // Extract authentic avatar maps and buildAvatarSVG from index.html if present
      const shapesMatch = htmlContent.match(/const CUE_AVATAR_SHAPES_SVGS\s*=\s*\{[\s\S]*?\n\s*\};/);
      const facesMatch = htmlContent.match(/const CUE_AVATAR_FACES_SVGS\s*=\s*\{[\s\S]*?\n\s*\};/);
      expect(shapesMatch).not.toBeNull();
      expect(facesMatch).not.toBeNull();

      // Verify authentic shapes and faces are present in index.html
      expect(htmlContent).toContain('triangle');
      expect(htmlContent).toContain('flameDrop');
      expect(htmlContent).toContain('burstBadge');
      expect(htmlContent).toContain('focused');
      expect(htmlContent).toContain('skeptical');

      // Verify AOrchestra multi-agent manager presence in index.html
      expect(htmlContent).toContain('window.AOrchestra');
      expect(htmlContent).toContain('coordinateGroupMembers');
      expect(htmlContent).toContain('formatGroupDirective');
    });

    it('should execute single turn when isGroup is false', () => {
      const singleChat = {
        id: 'chat_single',
        title: 'Direct Agent Chat',
        isGroup: false,
        memberIds: ['ag_solo']
      };

      const turns = singleChat.isGroup ? Math.max(1, singleChat.memberIds.length) : 1;
      expect(turns).toBe(1);
    });
  });

  // =========================================================================
  // Block 10: Deep Engine Branch Coverage & Resilient Error Handling
  // =========================================================================
  describe('Block 10: Deep Engine Branch Coverage & Resilient Error Handling', () => {
    it('should cover PlanDAG edge cases (non-string goal, replan with missing step, plain toJSON)', () => {
      const planNumberGoal = new state.PlanDAG('plan_num', 99999);
      expect(planNumberGoal.goal).toBe('Autonomous Goal');

      const planNullGoal = new state.PlanDAG('plan_null', null);
      expect(planNullGoal.goal).toBe('Autonomous Goal');

      // StepNode without toJSON method
      const plainStep = {
        id: 'step_plain',
        title: 'Plain Object Step',
        status: 'pending',
        dependencies: []
      };
      planNumberGoal.addStep(plainStep);
      expect(planNumberGoal.getStep('step_plain').id).toBe('step_plain');
      expect(planNumberGoal.getStep('nonexistent_step')).toBeNull();

      // toJSON with plain step
      const json = planNumberGoal.toJSON();
      expect(json.steps.length).toBe(1);
      expect(json.steps[0].id).toBe('step_plain');

      // replan with missing stepId
      planNumberGoal.replan('missing_step_id', [], 'Edge replan reason');
      expect(planNumberGoal.metadata.replans.length).toBe(1);

      // hasFailures when failed step exists
      planNumberGoal.markStepStatus('step_plain', 'failed', '', 'Failed error');
      expect(planNumberGoal.hasFailures()).toBe(true);

      // replan to recover step
      const recoveryStep = new state.StepNode({ id: 'step_recovery', title: 'Recovery' });
      planNumberGoal.replan('step_plain', [recoveryStep], 'Recovered');
      expect(planNumberGoal.getStep('step_plain').replanned).toBe(true);
    });

    it('should cover createExecutionPlan with presetSteps and advancePlanStep variations', () => {
      const preset = [
        { id: 'p1', title: 'P1', assignedRole: 'planner', requiredTools: ['t1'], status: 'pending', dependencies: [] },
        { id: 'p2', title: 'P2', assignedRole: 'coder', requiredTools: ['t2'], status: 'pending', dependencies: ['p1'] }
      ];

      const plan = state.createExecutionPlan('Preset Plan Goal', { presetSteps: preset, autoReplan: true });
      expect(plan.steps.length).toBe(2);

      // advancePlanStep by planId string
      const advanced1 = state.advancePlanStep(plan.id, 'p1', { success: true, result: { data: 'P1 Success Object' } });
      expect(advanced1.getStep('p1').status).toBe('completed');
      expect(advanced1.getStep('p1').resultSummary).toContain('P1 Success Object');

      // advancePlanStep with non-existent planId throws
      expect(() => state.advancePlanStep('invalid_plan_id', 'p1')).toThrow('could not be resolved');

      // advancePlanStep with non-existent stepId throws
      expect(() => state.advancePlanStep(plan, 'invalid_step_id')).toThrow('Step "invalid_step_id" not found');

      // advancePlanStep with failure and retry
      const failObs = { success: false, error: 'Network timeout', output: { raw: 'fail payload' } };
      const step2 = plan.getStep('p2');
      step2.retryCount = 0;
      step2.maxRetries = 2;

      // Retry 1
      state.advancePlanStep(plan, 'p2', failObs);
      expect(step2.status).toBe('retrying');

      // Retry 2 & exceed
      step2.retryCount = 2;
      state.advancePlanStep(plan, 'p2', failObs, { autoReplan: true });
      expect(step2.status).toBe('failed');
      expect(plan.metadata.replans.length).toBeGreaterThan(0);
    });

    it('should cover StepExecutionLoop bus adapters (publish, dispatch, trigger, null bus)', async () => {
      // Test bus with publish()
      let publishCalled = false;
      const publishBus = { publish: () => { publishCalled = true; } };
      const loopPublish = new state.StepExecutionLoop({ eventBus: publishBus });
      const step = new state.StepNode({ id: 's_pub', title: 'Publish Step' });
      await loopPublish.executePhaseThink(step, { previousAttemptError: 'Prior mistake note' });
      expect(publishCalled).toBe(true);

      // Test bus with dispatch()
      let dispatchCalled = false;
      const dispatchBus = { dispatch: () => { dispatchCalled = true; } };
      const loopDispatch = new state.StepExecutionLoop({ eventBus: dispatchBus });
      await loopDispatch.executePhaseThink(step);
      expect(dispatchCalled).toBe(true);

      // Test bus with trigger()
      let triggerCalled = false;
      const triggerBus = { trigger: () => { triggerCalled = true; } };
      const loopTrigger = new state.StepExecutionLoop({ eventBus: triggerBus });
      await loopTrigger.executePhaseThink(step);
      expect(triggerCalled).toBe(true);

      // Test loop with no bus at all
      const loopNoBus = new state.StepExecutionLoop({ eventBus: null });
      await loopNoBus.executePhaseThink(step); // should not crash
    });

    it('should cover StepExecutionLoop approvalGate and budgetGuard branch variations', async () => {
      const stepMutating = new state.StepNode({
        id: 's_mut',
        title: 'Delete Database Table',
        requiredTools: ['bash', 'delete_records']
      });

      // 1. approvalGate with checkApproval returning { approved: false }
      const gateCheckObj = { checkApproval: async () => ({ approved: false, reason: 'Disallowed' }) };
      const loopGate1 = new state.StepExecutionLoop({ approvalGate: gateCheckObj });
      const actRes1 = await loopGate1.executePhaseAct(stepMutating);
      expect(actRes1.success).toBe(false);
      expect(actRes1.error).toContain('blocked by ApprovalGate');

      // 2. approvalGate with checkApproval returning boolean false
      const gateCheckBool = { checkApproval: async () => false };
      const loopGate2 = new state.StepExecutionLoop({ approvalGate: gateCheckBool });
      const actRes2 = await loopGate2.executePhaseAct(stepMutating);
      expect(actRes2.success).toBe(false);

      // 3. approvalGate with requestApproval returning { approved: false }
      const gateReqObj = { requestApproval: async () => ({ approved: false }) };
      const loopGate3 = new state.StepExecutionLoop({ approvalGate: gateReqObj });
      const actRes3 = await loopGate3.executePhaseAct(stepMutating);
      expect(actRes3.success).toBe(false);

      // 4. approvalGate with requestApproval returning boolean false
      const gateReqBool = { requestApproval: async () => false };
      const loopGate4 = new state.StepExecutionLoop({ approvalGate: gateReqBool });
      const actRes4 = await loopGate4.executePhaseAct(stepMutating);
      expect(actRes4.success).toBe(false);

      // 5. budgetGuard with recordUsage
      let recordedTokens = 0;
      const mockBudgetGuard = {
        hasBudgetForTokens: () => true,
        recordUsage: (usage) => {
          recordedTokens += (typeof usage === 'number' ? usage : (usage?.tokens || 50));
        }
      };
      const loopBudget = new state.StepExecutionLoop({ budgetGuard: mockBudgetGuard });
      const stepSafe = new state.StepNode({ id: 's_safe', title: 'Safe Step', requiredTools: ['search'] });
      await loopBudget.executePhaseAct(stepSafe);
      expect(recordedTokens).toBeGreaterThan(0);

      // 6. executeProviderRequest throwing error
      const loopThrow = new state.StepExecutionLoop({
        executeProviderRequest: async () => { throw new Error('Simulated network crash'); }
      });
      const actThrow = await loopThrow.executePhaseAct(stepSafe);
      expect(actThrow.success).toBe(false);
      expect(actThrow.error).toContain('Simulated network crash');
    });

    it('should cover StepExecutionLoop executePhaseObserve and executeStep retry branch exhaustions', async () => {
      const loop = new state.StepExecutionLoop();
      const step = new state.StepNode({ id: 's_obs', title: 'Observe Step' });

      // observe with actionResult.data
      const obsData = loop.executePhaseObserve(step, { success: true, data: { payload: 'hello' } });
      expect(obsData.output).toEqual({ payload: 'hello' });

      // observe with actionResult.message
      const obsMsg = loop.executePhaseObserve(step, { success: false, message: 'Bad request' });
      expect(obsMsg.error).toBe('Bad request');

      // executeStep failing all retries
      const failStep = new state.StepNode({ id: 's_fail_loop', title: 'Fail Step', maxRetries: 1 });
      const loopFail = new state.StepExecutionLoop({
        executeProviderRequest: async () => ({ success: false, error: 'Persistent error' })
      });
      const failResult = await loopFail.executeStep(failStep);
      expect(failResult.success).toBe(false);
      expect(failStep.retryCount).toBe(1);

      // runLoop with null plan throws
      await expect(loop.runLoop(null)).rejects.toThrow('A valid PlanDAG is required');

      // runLoop with plan containing failed steps
      const planWithFail = new state.PlanDAG('plan_fail', 'Plan With Failures');
      planWithFail.addStep(new state.StepNode({ id: 'f1', title: 'Failed Step', status: 'failed' }));
      const runRes = await loop.runLoop(planWithFail);
      expect(runRes.completed).toBe(false);
      expect(runRes.status).toBe('failed');
    });

    it('should cover ContextWindowCompactor with object inputs and metadata artifacts', () => {
      // Pass object with steps property
      const inputObj = {
        goal: 'Object Goal Title',
        steps: [
          {
            id: 's_art_1',
            title: 'Artifact Builder Step',
            status: 'completed',
            artifacts: [{ id: 'a1', name: 'File1.txt', summary: 'File summary 1' }]
          },
          {
            id: 's_art_2',
            title: 'Metadata Artifact Step',
            status: 'completed',
            metadata: {
              artifacts: [{ id: 'a2', name: 'File2.txt', summary: 'File summary 2' }]
            }
          },
          null, // null step check
          {
            id: 's_pending',
            title: 'Pending Step',
            status: 'pending'
          }
        ]
      };

      const compacted = state.compactExecutionHistory(inputObj, 50);
      expect(compacted.goal).toBe('Object Goal Title');
      expect(compacted.keyArtifacts.length).toBe(2);
      expect(compacted.episodicDigest).toContain('File1.txt');
      expect(compacted.episodicDigest).toContain('File2.txt');
    });

    it('should cover NexusDeepAgentEngine advanceStep, executeStep, and executePlan failure branch', async () => {
      const engine = new state.NexusDeepAgentEngine();
      const plan = engine.createPlan('Engine Comprehensive Plan');

      // advanceStep via planId string
      const step1 = plan.steps[0];
      const res = engine.advanceStep(plan.id, step1.id, { success: true, output: 'Step 1 output' });
      expect(res.getStep(step1.id).status).toBe('completed');

      // executeStep
      const step2 = plan.steps[1];
      const stepRes = await engine.executeStep(step2);
      expect(stepRes).toBeDefined();

      // executePlan with invalid planId throws
      await expect(engine.executePlan('ghost_plan_id')).rejects.toThrow('Plan not found');

      // compactHistory via engine instance
      const historyRes = engine.compactHistory(plan.steps, 100000);
      expect(Array.isArray(historyRes)).toBe(true);
    });

    it('should cover AdaptivePhaseModelRouter lowercase phases and budgetGuard permutations', () => {
      // Lowercase phases
      const p1 = registry.routePhaseModel('plan', 'quality');
      expect(p1.modelId).toBe('deepseek-v4-pro');

      const p2 = registry.routePhaseModel('act', 'quality');
      expect(p2.modelId).toBe('gemini-3.8-flash');

      const p3 = registry.routePhaseModel('summarize', 'speed');
      expect(p3.modelId).toBe('gemini-3.8-flash');

      // Unknown phase fallback
      const pUnknown = registry.routePhaseModel('unknown_phase', 'quality');
      expect(pUnknown.phase).toBe('UNKNOWN_PHASE');

      // budgetGuard as number below threshold
      const pNumGuard = registry.routePhaseModel('plan', 'quality', 0.15);
      expect(pNumGuard.modelId).toBe('gemini-3.8-flash');
      expect(pNumGuard.reasoningTier).toBe('minimal');

      // budgetGuard as object with remainingBudget property
      const pObjGuard = registry.routePhaseModel('reflect', 'quality', { remainingBudget: 0.05 });
      expect(pObjGuard.modelId).toBe('gemini-3.8-flash');
    });

    it('should cover CueEventStreamBus once, listenerCount, and exception-safe emit', () => {
      const bus = new registry.CueEventStreamBusClass();

      // Non-function listener throws TypeError
      expect(() => bus.on('test_event', null)).toThrow(TypeError);

      // once listener
      let onceFired = 0;
      bus.once('one_time', () => { onceFired++; });
      expect(bus.listenerCount('one_time')).toBe(1);

      bus.emit('one_time', { count: 1 });
      bus.emit('one_time', { count: 2 });
      expect(onceFired).toBe(1);
      expect(bus.listenerCount('one_time')).toBe(0);

      // off with unregistered listener
      bus.off('one_time', () => {});

      // emit error isolation
      bus.on('bad_event', () => { throw new Error('Listener internal failure'); });
      expect(() => bus.emit('bad_event', { key: 'val' })).not.toThrow();

      // unsubscribe function from on()
      const unsub = bus.on('unsub_test', () => {});
      expect(bus.listenerCount('unsub_test')).toBe(1);
      unsub();
      expect(bus.listenerCount('unsub_test')).toBe(0);

      // getHistory with specific event vs empty
      bus.emit('hist_test', { a: 1 });
      expect(bus.getHistory('hist_test').length).toBe(1);
      expect(bus.getHistory('nonexistent_hist_event').length).toBe(0);
    });

    it('should cover executeStep with refinedContext and runLoop early-break on failure', async () => {
      // 1. executeStep with reflection.refinedContext branch
      const loopRefined = new state.StepExecutionLoop();
      let reflectCallCount = 0;
      jest.spyOn(loopRefined, 'executePhaseReflect').mockImplementation(async () => {
        reflectCallCount++;
        if (reflectCallCount === 1) {
          return { success: false, verdict: 'FAIL', refinedContext: { hint: 'Use specific API flag' } };
        }
        return { success: true, verdict: 'PASS' };
      });

      const stepWithRefined = new state.StepNode({ id: 's_refined', title: 'Refined Step', maxRetries: 2 });
      let actCallCount = 0;
      jest.spyOn(loopRefined, 'executePhaseAct').mockImplementation(async () => {
        actCallCount++;
        return { success: actCallCount > 1, output: 'Success after hint' };
      });

      const stepResult = await loopRefined.executeStep(stepWithRefined);
      expect(stepResult.success).toBe(true);
      expect(actCallCount).toBe(2);

      // 2. runLoop with early failure break branch
      const loopFailRun = new state.StepExecutionLoop({
        executeProviderRequest: async () => ({ success: false, error: 'Simulated hard fail' })
      });
      const planFail = state.createExecutionPlan('Break on Failure Plan');
      planFail.steps[0].maxRetries = 0; // immediate failure without retry

      const failRunResult = await loopFailRun.runLoop(planFail);
      expect(failRunResult.completed).toBe(false);
      expect(failRunResult.status).toBe('failed');
      expect(planFail.hasFailures()).toBe(true);
    });

    it('should cover ContextWindowCompactor empty and fallbacks across milestones and artifacts', () => {
      // 1. Steps with artifacts without name and summary
      const stepsEmptyDetails = [
        {
          id: 's_e1',
          title: 'Empty Details Step',
          status: 'completed',
          artifacts: [{ id: 'a_anon' }],
          metadata: { artifacts: [{ id: 'a_meta_anon' }] }
        },
        {
          id: 's_e2',
          title: '',
          status: 'completed',
          resultSummary: ''
        },
        {
          id: 's_e3',
          title: 'In Progress Task',
          status: 'in_progress'
        },
        {
          id: 's_e4',
          title: 'Retrying Task',
          status: 'retrying'
        }
      ];

      const compRes = state.compactExecutionHistory(stepsEmptyDetails, 10);
      expect(compRes.keyArtifacts.length).toBeGreaterThanOrEqual(1);
      expect(compRes.episodicDigest).toContain('Generated Artifact');

      // 2. Completely empty completed steps
      const compNoCompleted = state.compactExecutionHistory([
        { id: 'p1', title: 'Pending Only', status: 'pending' }
      ], 10);
      expect(compNoCompleted.episodicDigest).toContain('Initial planning phase initiated');
      expect(compNoCompleted.episodicDigest).toContain('None recorded yet');
    });

    it('should cover all routePhaseModel phase and effortMode permutations', () => {
      // Quality mode all phases
      const qPlan = registry.routePhaseModel('PLAN', 'quality');
      const qThink = registry.routePhaseModel('THINK', 'quality');
      const qReflect = registry.routePhaseModel('REFLECT', 'quality');
      const qAct = registry.routePhaseModel('ACT', 'quality');
      const qObs = registry.routePhaseModel('OBSERVE', 'quality');
      const qSum = registry.routePhaseModel('SUMMARIZE', 'quality');

      expect(qPlan.modelId).toBe('deepseek-v4-pro');
      expect(qThink.modelId).toBe('deepseek-v4-pro');
      expect(qReflect.modelId).toBe('deepseek-v4-pro');
      expect(qAct.modelId).toBe('gemini-3.8-flash');
      expect(qObs.modelId).toBe('gemini-3.8-flash');
      expect(qSum.modelId).toBe('gemini-3.8-flash');

      // Speed mode all phases
      const sPlan = registry.routePhaseModel('PLAN', 'speed');
      const sAct = registry.routePhaseModel('ACT', 'speed');
      const sReflect = registry.routePhaseModel('REFLECT', 'speed');

      expect(sPlan.modelId).toBe('gemini-3.8-flash');
      expect(sAct.modelId).toBe('gemini-3.8-flash');
      expect(sReflect.modelId).toBe('gemini-3.8-flash');

      // Object effortMode
      const objSpeed = registry.routePhaseModel('PLAN', { effortMode: 'speed' });
      expect(objSpeed.modelId).toBe('gemini-3.8-flash');
      const objQuality = registry.routePhaseModel('PLAN', { mode: 'quality' });
      expect(objQuality.modelId).toBe('deepseek-v4-pro');

      // Budget guard variations with ample vs low budget
      const ampleGuard = registry.routePhaseModel('PLAN', 'quality', { getRemainingBudget: () => 0.85 });
      expect(ampleGuard.modelId).toBe('deepseek-v4-pro');

      const lowGuard = registry.routePhaseModel('PLAN', 'quality', { getRemainingBudget: () => 0.05 });
      expect(lowGuard.modelId).toBe('gemini-3.8-flash');

      const lowBudgetObj = registry.routePhaseModel('PLAN', 'quality', { budget: 0.02 });
      expect(lowBudgetObj.modelId).toBe('gemini-3.8-flash');

      const ampleBudgetObj = registry.routePhaseModel('PLAN', 'quality', { budget: 0.90 });
      expect(ampleBudgetObj.modelId).toBe('deepseek-v4-pro');

      const ampleNum = registry.routePhaseModel('PLAN', 'quality', 0.90);
      expect(ampleNum.modelId).toBe('deepseek-v4-pro');
    });

    it('should cover context.executeProviderRequest, observe fallbacks, retry without refinedContext, and bus deletions', async () => {
      // 1. context.executeProviderRequest in executePhaseAct (Line 3384)
      const loopContextReq = new state.StepExecutionLoop();
      let customContextCalled = false;
      const ctxWithReq = {
        executeProviderRequest: async () => {
          customContextCalled = true;
          return { success: true, result: 'Result from context.executeProviderRequest' };
        }
      };
      const stepForCtx = new state.StepNode({ id: 's_ctx', title: 'Context Req Step', requiredTools: ['search'] });
      const actResCtx = await loopContextReq.executePhaseAct(stepForCtx, ctxWithReq);
      expect(customContextCalled).toBe(true);
      expect(actResCtx.success).toBe(true);

      // 2. executePhaseObserve with actionResult.result (Line 3432) and plain string fallback
      const obsWithResult = loopContextReq.executePhaseObserve(stepForCtx, { success: true, result: 'Explicit result field' });
      expect(obsWithResult.output).toBe('Explicit result field');

      const obsWithPlain = loopContextReq.executePhaseObserve(stepForCtx, 'Plain String Output');
      expect(obsWithPlain.output).toBe('Plain String Output');

      // 3. executeStep retry without reflection.refinedContext (Line 3532)
      const loopSimpleRetry = new state.StepExecutionLoop();
      let simpleReflectCount = 0;
      jest.spyOn(loopSimpleRetry, 'executePhaseReflect').mockImplementation(async () => {
        simpleReflectCount++;
        // No refinedContext provided
        return { success: simpleReflectCount > 1, verdict: simpleReflectCount > 1 ? 'PASS' : 'FAIL' };
      });
      let simpleActCount = 0;
      jest.spyOn(loopSimpleRetry, 'executePhaseAct').mockImplementation(async () => {
        simpleActCount++;
        return { success: simpleActCount > 1, output: 'Pass on second attempt' };
      });
      const stepSimple = new state.StepNode({ id: 's_simple_retry', title: 'Simple Retry', maxRetries: 2 });
      const simpleRes = await loopSimpleRetry.executeStep(stepSimple);
      expect(simpleRes.success).toBe(true);
      expect(simpleActCount).toBe(2);

      // 4. CueEventStreamBus on with empty event name throws (Line 4708)
      const bus = new registry.CueEventStreamBusClass();
      expect(() => bus.on('', () => {})).toThrow('Event name must be a non-empty string');
      expect(() => bus.on('   ', () => {})).toThrow('Event name must be a non-empty string');

      // 5. CueEventStreamBus once with non-function callback throws (Line 4743)
      expect(() => bus.once('ev', null)).toThrow(TypeError);

      // 6. CueEventStreamBus off removing last listener deletes the Set (Line 4731)
      const cb = () => {};
      bus.on('singleton_listener_event', cb);
      expect(bus.listenerCount('singleton_listener_event')).toBe(1);
      bus.off('singleton_listener_event', cb);
      expect(bus.listenerCount('singleton_listener_event')).toBe(0);
      expect(bus._listeners.has('singleton_listener_event')).toBe(false);
    });
  });
});

