import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VerdictPicker from '../components/events/VerdictPicker.vue'
import i18n from '../i18n'
import type { Verdict } from '../types/event'

function mountPicker(modelValue: Verdict | null, artistName?: string) {
  return mount(VerdictPicker, {
    props: { modelValue, artistName },
    global: { plugins: [i18n] },
  })
}

type Picker = ReturnType<typeof mountPicker>

const VERDICTS: Verdict[] = ['dislike', 'one-star', 'two-stars', 'three-stars']
const STAR_VERDICTS: Verdict[] = ['one-star', 'two-stars', 'three-stars']

// Dislike is one button at every width; only the star steps are laid out twice,
// once for `md` and up and once for the narrow filling control.
function button(wrapper: Picker, verdict: Verdict, layout: 'wide' | 'narrow' = 'wide') {
  return verdict === 'dislike'
    ? wrapper.find('[data-verdict="dislike"]')
    : wrapper.find(`[data-layout="${layout}"] [data-verdict="${verdict}"]`)
}

function wideButtons(wrapper: Picker) {
  return VERDICTS.map((verdict) => button(wrapper, verdict))
}

describe('VerdictPicker', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('offers exactly the four verdicts and no fifth control', () => {
    const wrapper = mountPicker(null)
    const offered = new Set(wrapper.findAll('button').map((b) => b.attributes('data-verdict')))

    expect([...offered].sort()).toEqual([...VERDICTS].sort())
  })

  it('shows the four verdicts left to right at `md` and up', () => {
    const wrapper = mountPicker(null)

    expect(wideButtons(wrapper).map((b) => b.exists())).toEqual([true, true, true, true])
  })

  it('emits each verdict when its button is chosen', async () => {
    for (const verdict of VERDICTS) {
      const wrapper = mountPicker(null)
      await button(wrapper, verdict).trigger('click')

      expect(wrapper.emitted('update:modelValue')).toEqual([[verdict]])
    }
  })

  it('clears back to the absent verdict when the chosen button is re-clicked', async () => {
    for (const verdict of VERDICTS) {
      const wrapper = mountPicker(verdict)
      await button(wrapper, verdict).trigger('click')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toHaveLength(1)
      // The absent verdict is null, not a falsy stand-in such as '' or undefined.
      expect(emitted?.[0]?.[0]).toBeNull()
    }
  })

  it('presses only the chosen verdict', () => {
    for (const verdict of VERDICTS) {
      const wrapper = mountPicker(verdict)
      const pressed = wideButtons(wrapper)
        .filter((b) => b.attributes('aria-pressed') === 'true')
        .map((b) => b.attributes('data-verdict'))

      expect(pressed).toEqual([verdict])
    }
  })

  it('presses nothing at all when the verdict is absent', () => {
    const wrapper = mountPicker(null)
    const pressed = wrapper.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true')

    expect(pressed).toHaveLength(0)
  })

  it('writes no verdict name on screen and names each button only to assistive tech', () => {
    const wrapper = mountPicker('three-stars')

    expect(wrapper.text()).toBe('')
    expect(wideButtons(wrapper).map((b) => b.attributes('aria-label'))).toEqual([
      'Not going back',
      'One star',
      'Two stars',
      'Three stars',
    ])
  })

  it('tooltips how to clear on the chosen button only', () => {
    const wrapper = mountPicker('two-stars')
    const titled = wideButtons(wrapper).filter((b) => b.attributes('title') !== undefined)

    expect(titled).toHaveLength(1)
    expect(titled[0].attributes('data-verdict')).toBe('two-stars')
    expect(titled[0].attributes('title')).toBe('Click again to clear')
  })

  it('groups the buttons and names whose verdict they set', () => {
    const group = mountPicker(null, 'Amelie Lens').find('[role="group"]')

    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-label')).toBe('Verdict for Amelie Lens')
  })

  it('fills the narrow star control from one up to the chosen step', () => {
    const wrapper = mountPicker('two-stars')
    const filled = STAR_VERDICTS.map((verdict) =>
      button(wrapper, verdict, 'narrow').find('svg').classes().includes('text-yellow-400'),
    )

    expect(filled).toEqual([true, true, false])
  })

  it('sets the step tapped in the narrow star control', async () => {
    const wrapper = mountPicker(null)
    await button(wrapper, 'three-stars', 'narrow').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['three-stars']])
  })

  it('clears from the narrow star control when the chosen step is re-tapped', async () => {
    const wrapper = mountPicker('three-stars')
    await button(wrapper, 'three-stars', 'narrow').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBeNull()
  })

  it('emits nothing while disabled', async () => {
    const wrapper = mountPicker(null)
    await wrapper.setProps({ disabled: true })
    await button(wrapper, 'one-star').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
