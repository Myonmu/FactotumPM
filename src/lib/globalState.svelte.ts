let loading = $state(false);

export function isLoading(){
    return loading.valueOf();
}
export function setLoading(state: boolean){
    loading = state;
}