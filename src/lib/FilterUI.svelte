<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/stores'
  import { ResizeStore, resize } from '@txstate-mws/svelte-components'
  import type { FormStore } from '@txstate-mws/svelte-forms'
  import { Button, Search } from 'carbon-components-svelte'
  import { Filter, FilterEdit, FilterRemove } from 'carbon-icons-svelte'
  import { createEventDispatcher, onMount } from 'svelte'
  import { findIndex, toQuery } from 'txstate-utils'
  import Form from './form/Form.svelte'
  import PanelFormDialog from './form/PanelFormDialog.svelte'
  import TabRadio from './TabRadio.svelte'
  import { addFilters, extractFilters, getUrl, replaceState, type TabRadioItem } from './util.js'
  type T = $$Generic<Record<string, any>>
  type Q = $$Generic<Record<string, any>>
  type P = $$Generic<Record<string, any>>

  export let search = false
  export let searchDebounceMs = 500
  export let quickFilterWidth = 800
  /**
   * Set this true if you always expect filtering to be fast. It will send the 'apply' event
   * every time the user interacts with the filters, instead of waiting for them to hit an Apply
   * button.
   */
  export let noApply = false
  /**
   * Default behavior is to save the state of the applied filters in the address bar so that
   * the page can be bookmarked. Set this true if you don't want this behavior, e.g. you have
   * two FilterUI instances on the screen at once.
   */
  export let skipUrlState = false
  export let tabs: TabRadioItem[] = []

  const dispatch = createEventDispatcher()

  let dialogOpen = false
  function showDialog () {
    dialogOpen = true
  }
  function cancelDialog () {
    dialogOpen = false
  }

  const resizeStore = new ResizeStore()
  $: hideQuickFilters = ($resizeStore.clientWidth ?? 1024) <= quickFilterWidth

  let dialogStore: FormStore<T>
  let quickStore: FormStore<Q>
  let pageFilterDataStore: FormStore<P>
  let dialogData: T
  let quickData: Q
  // Adding 'pageFilterData' to capture fields that are hidden or not user controllable and should not be counted towards the filter count.
  let pageFilterData: P
  let tabIndex = 0
  let selectedTab: string | undefined
  let searchStr: string | undefined
  let dialogPreApplyCount = 0
  let filterCount: number
  let dialogFilterCount: number
  $: dialogFilterCount = dialogData ? countRecords(dialogData) : 0
  $: filterCount = (quickData ? countRecords(quickData) : 0) + dialogFilterCount + (searchStr ? 1 : 0)

  function countRecords<T extends Record<string, any>> (value: T): number {
    return Object.keys(value).reduce((count, key) => {
      const val = value[key]
      if (val === undefined || val === null) return count
      if (Array.isArray(val)) {
        return count + val.reduce((arrayCount, item) => {
          if (typeof item === 'object' && !Array.isArray(item)) {
            return arrayCount + countRecords(item)
          }
          return arrayCount + 1
        }, 0)
      }
      return count + 1
    }, 0)
  }

  function updateFilters () {
    if (!browser) return
    const merged = { t: selectedTab, f: dialogData, p: pageFilterData, q: quickData, search: searchStr }
    if (!skipUrlState) {
      const url = addFilters(getUrl(), merged)
      replaceState(url)
    }
    dispatch('apply', { tab: merged.t, ...merged.f, ...merged.q, ...merged.p, search: merged.search })
  }

  async function onQuickValidate (data: Q) {
    quickData = data
    updateFilters()
    return []
  }

  async function onDialogSubmit (data: T) {
    dialogData = data
    updateFilters()
    dialogOpen = false
    return {
      success: true,
      messages: [],
      data
    }
  }

  async function onDialogValidate (data: T) {
    if (noApply) {
      dialogData = data
      updateFilters()
    }
    dialogPreApplyCount = countRecords(data)
    return []
  }

  async function onPageFilterDataValidate (data: P) {
    pageFilterData = data
    updateFilters()
    return []
  }

  function onTabChange (e: CustomEvent<any>) {
    selectedTab = e.detail.value
    updateFilters()
  }

  let searchTimer = 0
  function onSearchInput (e: Event) {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchStr = (e.target as HTMLInputElement)?.value ?? ''
      updateFilters()
    }, searchDebounceMs)
  }

  function clearAllFilters () {
    dialogData = {} as const as T
    quickData = {} as const as Q
    searchStr = undefined
    void dialogStore?.setData({})
    void quickStore?.setData({})
    updateFilters()
  }

  function clearDialogFilters () {
    void dialogStore?.setData({})
  }

  onMount(() => {
    if (browser && !skipUrlState) {
      const params = extractFilters($page.url)
      dialogData = params.f
      quickData = params.q
      pageFilterData = params.p
      tabIndex = findIndex(tabs, t => toQuery(t.value) === toQuery(params.t)) ?? 0
      selectedTab = tabs?.[tabIndex]?.value ?? undefined
      searchStr = params.search
      void quickStore?.setData(quickData)
      void pageFilterDataStore?.setData(pageFilterData)
      dispatch('mount', { tab: selectedTab, ...dialogData, ...quickData, ...pageFilterData, search: searchStr })
    }
  })
</script>

<div use:resize={{ store: resizeStore }} class="filter-ui-container [ flex flex-wrap items-end gap-2 mb-4 ]">
  {#if tabs.length}
    <TabRadio selectedIndex={tabIndex} on:change={onTabChange} {tabs} />
  {/if}
  {#if search}
    <div class="filter-ui-search-container">
      <Search on:input={onSearchInput} value={searchStr} size="lg" on:clear={onSearchInput}/>
    </div>
  {/if}
  {#if $$slots.quickfilters && !hideQuickFilters}
    <Form bind:store={quickStore} validate={onQuickValidate} submit={async data => ({ success: true, messages: [], data })} class="quickfilters-form [ flex ]">
      <slot name="quickfilters" />
      <svelte:fragment slot="submit">&nbsp;</svelte:fragment>
    </Form>
  {/if}
  {#if $$slots.pageFilterData }
    <Form bind:store={pageFilterDataStore} validate={onPageFilterDataValidate} submit={async data => ({ success: true, messages: [], data })} class="page-filter-data-form [ hidden ] ">
      <slot name="pageFilterData" />
      <svelte:fragment slot="submit">&nbsp;</svelte:fragment>
    </Form>
  {/if}
  {#if $$slots.default || $$slots.quickfilters}
    {#if $$slots.default || hideQuickFilters}
      <Button kind={dialogFilterCount ? 'primary' : 'secondary'} size="field" icon={dialogFilterCount ? FilterEdit : Filter} on:click={showDialog}>{$$slots.quickfilters && !hideQuickFilters ? dialogFilterCount ? `${dialogFilterCount}` : 'More' : dialogFilterCount ? `${dialogFilterCount}` : 'Show'} {dialogFilterCount !== 1 ? 'Filters' : 'Filter'}</Button>
    {/if}
    <div class="clear-filters-wrap">
     {#if filterCount > 0}
      <Button kind="ghost" size="field" icon={FilterRemove} on:click={clearAllFilters}>Clear All Filters</Button>
    {/if}
  </div>
  <PanelFormDialog bind:open={dialogOpen} preload={dialogData} title="{noApply ? 'Choose' : 'Apply'} Filters" bind:store={dialogStore} submit={onDialogSubmit} validate={onDialogValidate} on:cancel={cancelDialog} cancelText={noApply ? '' : 'Cancel'} submitText={noApply ? '' : 'Apply'}>
    <svelte:fragment slot="beforeform">
      {#if hideQuickFilters}
        <Form bind:store={quickStore} validate={onQuickValidate} submit={async data => ({ success: true, messages: [], data })} class="quickfiltershidden-form">
          <slot name="quickfilters" />
          <svelte:fragment slot="submit">&nbsp;</svelte:fragment>
        </Form>
      {/if}
    </svelte:fragment>
    <slot />
    {#if filterCount || dialogPreApplyCount}
      <div class="clear-filters-wrap [ absolute left-0 bottom-0 p-2 ]">
        <Button kind="ghost" icon={FilterRemove} size="field" on:click={clearDialogFilters}>Clear Filters</Button>
      </div>
    {/if}
  </PanelFormDialog>
  {/if}
</div>

<style>
  :global(.quickfilters-form > div:last-child) {
    margin-right: 0;
  }
  :global(.quickfiltershidden-form ~ form) {
    margin-top: 0;
  }
  :global(.quickfilters-form > div) {
    display: inline-block;
    margin-right: .5rem;
    width: 12rem;
    margin-top: 0;
  }
  :global(.page-filter-data-form) {
    display: none;
  }
</style>
